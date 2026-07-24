// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IFAssetAdapter} from "../interfaces/IFAssetAdapter.sol";
import {IMintingTagManager} from "../interfaces/IMintingTagManager.sol";
import {IParentVault} from "../interfaces/IParentVault.sol";

/**
 * @title FAssetAdapter
 * @notice Routes tag-based FAsset direct mints into the FlareYield ParentVault.
 * @dev The configured direct-mint executor must call {processDirectMint} immediately after completing
 *      the Flare AssetManager operation. The adapter verifies the FAsset balance delta before queuing
 *      it, so the amount that reaches ERC-4626 is the real post-fee amount rather than a quoted amount.
 */
contract FAssetAdapter is IFAssetAdapter, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct PendingDirectMint {
        address receiver;
        uint256 tag;
        uint256 assets;
    }

    error ZeroAddress();
    error IncorrectReservationFee(uint256 expected, uint256 received);
    error VaultAssetMismatch(address vaultAsset, address adapterAsset);
    error ZeroDepositId();
    error UnknownTag(uint256 tag);
    error NotTagUser(address caller, uint256 tag);
    error NotTagExecutor(address caller, uint256 tag);
    error TagExecutorNotActive(uint256 tag, address expectedExecutor, address activeExecutor);
    error InvalidMintingRecipient(uint256 tag, address recipient);
    error TagHasPendingMint(uint256 tag, bytes32 depositId);
    error DirectMintAlreadyProcessed(bytes32 depositId);
    error UnknownDirectMint(bytes32 depositId);
    error UnexpectedMintBalance(uint256 reportedAmount, uint256 observedAmount);
    error ZeroMintedAssets();
    error InsufficientFAssetBalance(uint256 required, uint256 available);
    error AccountingInvariantBroken(uint256 balance, uint256 pendingAssets);

    event MintingTagRegistered(uint256 indexed tag, address indexed user, address indexed executor);
    event TagExecutorUpdated(uint256 indexed tag, address indexed previousExecutor, address indexed newExecutor);
    event DirectMintProcessed(
        bytes32 indexed depositId, uint256 indexed tag, address indexed receiver, uint256 postFeeAssets
    );
    event DirectMintSettled(bytes32 indexed depositId, address indexed receiver, uint256 assets, uint256 shares);
    event DefaultDirectMintExecutorUpdated(address indexed previousExecutor, address indexed newExecutor);

    IERC20 public immutable fAsset;
    IMintingTagManager public immutable mintingTagManager;
    IParentVault public immutable vault;

    /// @notice Executor automatically assigned to newly reserved tags.
    address public defaultDirectMintExecutor;

    /// @notice Sum of direct-mint balances recorded but not yet transferred to the vault.
    uint256 public totalPendingFAssets;

    /// @notice User credited for a tag. The adapter remains the NFT owner, preventing tag transfer from changing credit.
    mapping(uint256 tag => address user) public tagUser;
    mapping(uint256 tag => address executor) public tagExecutor;
    mapping(uint256 tag => bytes32 depositId) public pendingDepositForTag;
    mapping(bytes32 depositId => PendingDirectMint directMint) public pendingDirectMints;
    mapping(bytes32 depositId => bool processed) public processedDirectMints;

    constructor(
        IERC20 fAsset_,
        IMintingTagManager mintingTagManager_,
        IParentVault vault_,
        address initialOwner,
        address defaultDirectMintExecutor_
    ) Ownable(initialOwner) {
        if (
            address(fAsset_) == address(0) || address(mintingTagManager_) == address(0) || address(vault_) == address(0)
                || defaultDirectMintExecutor_ == address(0)
        ) revert ZeroAddress();
        if (vault_.asset() != address(fAsset_)) revert VaultAssetMismatch(vault_.asset(), address(fAsset_));

        fAsset = fAsset_;
        mintingTagManager = mintingTagManager_;
        vault = vault_;
        defaultDirectMintExecutor = defaultDirectMintExecutor_;
    }

    /**
     * @notice Reserves a new Flare minting tag and permanently maps it to the caller's FlareYield account.
     * @dev The adapter owns the tag NFT so its recipient cannot be redirected after registration. The tag's
     *      executor is set on Flare and subject to MintingTagManager's executor-change cooldown.
     */
    function registerMintingTag() external payable override whenNotPaused nonReentrant returns (uint256 tag) {
        uint256 reservationFee = mintingTagManager.reservationFee();
        if (msg.value != reservationFee) revert IncorrectReservationFee(reservationFee, msg.value);

        tag = mintingTagManager.reserve{value: msg.value}();
        mintingTagManager.setMintingRecipient(tag, address(this));
        mintingTagManager.setAllowedExecutor(tag, defaultDirectMintExecutor);

        tagUser[tag] = msg.sender;
        tagExecutor[tag] = defaultDirectMintExecutor;

        emit MintingTagRegistered(tag, msg.sender, defaultDirectMintExecutor);
    }

    /**
     * @notice Records an actual, post-fee FAsset balance minted using `tag`.
     * @dev `observedMintedAmount` is sourced from Flare's DirectMintingExecuted event. It is not trusted for
     *      accounting: it must exactly match the unallocated FAsset balance observed in this contract.
     */
    function processDirectMint(uint256 tag, bytes32 depositId, uint256 observedMintedAmount)
        external
        override
        whenNotPaused
        nonReentrant
    {
        address receiver = tagUser[tag];
        if (receiver == address(0)) revert UnknownTag(tag);
        if (depositId == bytes32(0)) revert ZeroDepositId();
        if (msg.sender != tagExecutor[tag]) revert NotTagExecutor(msg.sender, tag);

        address activeExecutor = mintingTagManager.allowedExecutor(tag);
        if (activeExecutor != msg.sender) revert TagExecutorNotActive(tag, msg.sender, activeExecutor);
        address recipient = mintingTagManager.mintingRecipient(tag);
        if (recipient != address(this)) revert InvalidMintingRecipient(tag, recipient);

        bytes32 existingDepositId = pendingDepositForTag[tag];
        if (existingDepositId != bytes32(0)) revert TagHasPendingMint(tag, existingDepositId);
        if (processedDirectMints[depositId]) revert DirectMintAlreadyProcessed(depositId);

        uint256 currentBalance = fAsset.balanceOf(address(this));
        if (currentBalance < totalPendingFAssets) {
            revert AccountingInvariantBroken(currentBalance, totalPendingFAssets);
        }
        uint256 postFeeAssets = currentBalance - totalPendingFAssets;
        if (postFeeAssets == 0) revert ZeroMintedAssets();
        if (postFeeAssets != observedMintedAmount) {
            revert UnexpectedMintBalance(observedMintedAmount, postFeeAssets);
        }

        processedDirectMints[depositId] = true;
        pendingDepositForTag[tag] = depositId;
        pendingDirectMints[depositId] = PendingDirectMint({receiver: receiver, tag: tag, assets: postFeeAssets});
        totalPendingFAssets += postFeeAssets;

        vault.queueFAssetDeposit(depositId, receiver);
        emit DirectMintProcessed(depositId, tag, receiver, postFeeAssets);
    }

    /**
     * @notice Transfers a previously processed direct mint into the ParentVault and realizes ERC-4626 shares.
     * @dev Callable by anyone so a user cannot be censored after the direct-mint executor has registered funds.
     */
    function settleDirectMint(bytes32 depositId) external override whenNotPaused nonReentrant returns (uint256 shares) {
        PendingDirectMint memory directMint = pendingDirectMints[depositId];
        if (directMint.receiver == address(0)) revert UnknownDirectMint(depositId);

        uint256 currentBalance = fAsset.balanceOf(address(this));
        if (currentBalance < directMint.assets) {
            revert InsufficientFAssetBalance(directMint.assets, currentBalance);
        }

        delete pendingDirectMints[depositId];
        delete pendingDepositForTag[directMint.tag];
        totalPendingFAssets -= directMint.assets;

        fAsset.forceApprove(address(vault), directMint.assets);
        shares = vault.settleFAssetDeposit(depositId, directMint.assets);
        fAsset.forceApprove(address(vault), 0);

        emit DirectMintSettled(depositId, directMint.receiver, directMint.assets, shares);
    }

    /**
     * @notice Changes the executor for a user-owned tag.
     * @dev Flare's MintingTagManager activates the new executor after its configured cooldown.
     */
    function setTagExecutor(uint256 tag, address newExecutor) external whenNotPaused nonReentrant {
        if (tagUser[tag] == address(0)) revert UnknownTag(tag);
        if (msg.sender != tagUser[tag]) revert NotTagUser(msg.sender, tag);
        if (newExecutor == address(0)) revert ZeroAddress();

        address previousExecutor = tagExecutor[tag];
        tagExecutor[tag] = newExecutor;
        mintingTagManager.setAllowedExecutor(tag, newExecutor);

        emit TagExecutorUpdated(tag, previousExecutor, newExecutor);
    }

    function setDefaultDirectMintExecutor(address newExecutor) external onlyOwner {
        if (newExecutor == address(0)) revert ZeroAddress();
        address previousExecutor = defaultDirectMintExecutor;
        defaultDirectMintExecutor = newExecutor;
        emit DefaultDirectMintExecutorUpdated(previousExecutor, newExecutor);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IParentVault} from "../interfaces/IParentVault.sol";
import {IAssetManager} from "../interfaces/IAssetManager.sol";
import {IMintingTagManager} from "../interfaces/IMintingTagManager.sol";

/**
 * @title SmartAccountDirectMintAdapter
 * @notice Atomic 1-click XRPL → Vault deposits using Flare Smart Account memos (0xFE opcode)
 * @dev Strategy: User sends XRP with 0xFE memo → FAssets mints → executeDirectMintingWithData
 *               calls this adapter → Adapter deposits into ParentVault → User receives vault shares
 *      
 *      Flow:
 *      1. User registers minting tag via this adapter
 *      2. User sends XRP on XRPL to Core Vault with:
 *         - Destination tag = their registered tag
 *         - Memo = 0xFE + hash(depositIntoVault call)
 *      3. Flare Data Connector observes XRP payment
 *      4. Executor calls AssetManager.executeDirectMintingWithData
 *      5. AssetManager mints FXRP and calls depositIntoVault on this adapter
 *      6. Adapter deposits FXRP into ParentVault
 *      7. Vault shares minted directly to user
 *      
 *      Result: 1 XRPL transaction = Vault shares (no manual settlement needed!)
 *      
 *      This is a breakthrough UX for the "Interoperable Asset Products" hackathon track.
 */
contract SmartAccountDirectMintAdapter is Ownable, IERC721Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Errors ────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error UnauthorizedCaller(address caller);
    error TagNotRegistered(uint256 tag);
    error TagAlreadyRegistered(uint256 tag);
    error InsufficientFAssets(uint256 expected, uint256 actual);
    error VaultDepositFailed();

    // ─── Events ────────────────────────────────────────────────────────────────
    event MintingTagRegistered(uint256 indexed tag, address indexed user, address indexed executor);
    event AtomicDepositExecuted(
        uint256 indexed tag,
        address indexed user,
        uint256 fAssetAmount,
        uint256 vaultShares
    );
    event ExecutorUpdated(uint256 indexed tag, address indexed newExecutor);

    // ─── Immutables ────────────────────────────────────────────────────────────
    /// @notice ParentVault that receives deposits
    IParentVault public immutable parentVault;

    /// @notice FAsset token (FXRP)
    IERC20 public immutable fAsset;

    /// @notice AssetManager for direct minting
    IAssetManager public immutable assetManager;

    /// @notice MintingTagManager
    IMintingTagManager public immutable mintingTagManager;

    /// @notice Default executor for direct minting
    address public immutable defaultExecutor;

    // ─── State ─────────────────────────────────────────────────────────────────
    /// @notice Maps minting tag to user address
    mapping(uint256 => address) public tagUser;

    /// @notice Maps minting tag to executor address
    mapping(uint256 => address) public tagExecutor;

    /// @notice User's registered tags
    mapping(address => uint256[]) public userTags;

    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(
        IParentVault parentVault_,
        IAssetManager assetManager_,
        IMintingTagManager mintingTagManager_,
        address defaultExecutor_,
        address initialOwner_
    ) Ownable(initialOwner_) {
        if (
            address(parentVault_) == address(0) ||
            address(assetManager_) == address(0) ||
            address(mintingTagManager_) == address(0) ||
            defaultExecutor_ == address(0)
        ) revert ZeroAddress();

        parentVault = parentVault_;
        assetManager = assetManager_;
        mintingTagManager = mintingTagManager_;
        defaultExecutor = defaultExecutor_;
        fAsset = IERC20(assetManager_.fAsset());

        // Approve vault to spend FAssets (for deposits)
        fAsset.forceApprove(address(parentVault_), type(uint256).max);
    }

    // ─── Public Functions ──────────────────────────────────────────────────────

    /**
     * @notice Register a new minting tag for 1-click deposits
     * @return tag The registered minting tag ID
     */
    function registerMintingTag() external payable nonReentrant returns (uint256 tag) {
        uint256 fee = mintingTagManager.reservationFee();
        if (msg.value < fee) revert InsufficientFAssets(fee, msg.value);

        // Reserve tag from MintingTagManager (correct 3-step process)
        tag = mintingTagManager.reserve{value: fee}();
        
        // Set recipient to this adapter
        mintingTagManager.setMintingRecipient(tag, address(this));
        
        // Set executor
        mintingTagManager.setAllowedExecutor(tag, defaultExecutor);

        // Store tag → user mapping
        tagUser[tag] = msg.sender;
        tagExecutor[tag] = defaultExecutor;
        userTags[msg.sender].push(tag);

        emit MintingTagRegistered(tag, msg.sender, defaultExecutor);

        // Refund excess
        if (msg.value > fee) {
            (bool success,) = msg.sender.call{value: msg.value - fee}("");
            require(success, "Refund failed");
        }
    }

    /**
     * @notice Update the executor for a specific tag
     * @param tag Minting tag ID
     * @param newExecutor New executor address
     */
    function setTagExecutor(uint256 tag, address newExecutor) external {
        if (tagUser[tag] != msg.sender) revert UnauthorizedCaller(msg.sender);
        if (newExecutor == address(0)) revert ZeroAddress();

        tagExecutor[tag] = newExecutor;
        emit ExecutorUpdated(tag, newExecutor);
    }

    /**
     * @notice Callback invoked by AssetManager after direct minting with 0xFE memo
     * @dev This is called atomically when executeDirectMintingWithData is executed
     * @param tag The minting tag that was used
     * @param fAssetAmount Amount of FAssets minted (post-fee)
     */
    function depositIntoVault(uint256 tag, uint256 fAssetAmount) external nonReentrant {
        // Only AssetManager can call this during executeDirectMintingWithData
        if (msg.sender != address(assetManager)) revert UnauthorizedCaller(msg.sender);

        address user = tagUser[tag];
        if (user == address(0)) revert TagNotRegistered(tag);

        // Verify we received the FAssets
        uint256 balance = fAsset.balanceOf(address(this));
        if (balance < fAssetAmount) revert InsufficientFAssets(fAssetAmount, balance);

        // Deposit into ParentVault (approval already set in constructor)
        // The vault will mint shares directly to the user
        uint256 shares = parentVault.deposit(fAssetAmount, user);

        if (shares == 0) revert VaultDepositFailed();

        emit AtomicDepositExecuted(tag, user, fAssetAmount, shares);
    }

    /**
     * @notice Get all tags registered by a user
     */
    function getUserTags(address user) external view returns (uint256[] memory) {
        return userTags[user];
    }

    /**
     * @notice Get registration instructions for users
     * @return coreVaultAddress The XRPL address to send XRP to
     * @return memoFormat Instructions for constructing the 0xFE memo
     */
    function getDepositInstructions(uint256 tag) external view returns (
        string memory coreVaultAddress,
        string memory memoFormat
    ) {
        if (tagUser[tag] == address(0)) revert TagNotRegistered(tag);

        coreVaultAddress = assetManager.directMintingPaymentAddress();
        memoFormat = "Use destination tag and 0xFE memo with depositIntoVault(tag, amount) call hash";
    }

    // ─── IERC721Receiver ───────────────────────────────────────────────────────

    /**
     * @notice Required to receive minting tag NFTs (if MintingTagManager uses NFTs)
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    // ─── Admin ─────────────────────────────────────────────────────────────────

    /**
     * @notice Emergency rescue of tokens accidentally sent here
     */
    function rescueToken(IERC20 token, address to, uint256 amount) external onlyOwner {
        token.safeTransfer(to, amount);
    }

    /**
     * @notice Rescue native currency accidentally sent here
     */
    function rescueNative(address payable to, uint256 amount) external onlyOwner {
        (bool success,) = to.call{value: amount}("");
        require(success, "Native transfer failed");
    }

    /**
     * @notice Required to receive native currency for tag registration fees
     */
    receive() external payable {}
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {ERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import {IParentVault} from "../interfaces/IParentVault.sol";
import {IStrategyAdapter} from "../interfaces/IStrategyAdapter.sol";

/**
 * @title ParentVault
 * @notice ERC-4626 Flux vault whose assets can be deployed through approved strategy adapters.
 * @dev Combines ERC-4626 vault shares (Flux Coins), FAsset direct-minting routing, and EIP-712 TEE rebalance execution.
 */
contract ParentVault is
    ERC4626Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuard,
    PausableUpgradeable,
    IParentVault
{
    using SafeERC20 for IERC20;

    uint16 public constant MAX_BPS = 10_000;
    uint256 public constant TEE_TIMEOUT = 7 days;
    uint256 public constant MIN_TWAP_WINDOW = 24 hours;
    uint256 public constant MAX_TWAP_AGE = 2 hours;

    bytes32 public constant REBALANCE_TYPEHASH = keccak256(
        "RebalancePayload(address newStrategy,uint256 minAmountOut,uint256 nonce,uint256 deadline,uint256 twapStart,uint256 twapEnd,bytes32 strategyDataHash)"
    );
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256("Flux ParentVault");
    bytes32 private constant VERSION_HASH = keccak256("1");

    error ZeroAddress();
    error UnauthorizedFAssetAdapter(address caller);
    error StrategyNotApproved(address strategy);
    error StrategyAssetMismatch(address strategy, address strategyAsset);
    error StrategyUnchanged();
    error InvalidNonce(uint256 expected, uint256 supplied);
    error RebalanceExpired(uint256 deadline, uint256 currentTimestamp);
    error InvalidTeeSignature(address recoveredSigner);
    error InvalidTwapWindow(uint256 twapStart, uint256 twapEnd);
    error StaleTwap(uint256 twapEnd, uint256 currentTimestamp);
    error SlippageExceeded(uint256 minAmountOut, uint256 actualAmountOut);
    error InsufficientLiquidity(uint256 required, uint256 available);
    error FallbackNotAvailable(uint256 availableAt);
    error PendingDepositAlreadyExists(bytes32 depositId);
    error UnknownPendingDeposit(bytes32 depositId);
    error InvalidLiquidityBuffer(uint16 bps);
    error InvalidAdapterDeposit(uint256 requested, uint256 actual);
    error UnexpectedAssetTransfer(uint256 expected, uint256 actual);
    error StrategyNotFullyWithdrawn(address strategy, uint256 residualValue);
    error FAssetDepositAlreadySettled(bytes32 depositId);

    event StrategyApprovalUpdated(address indexed strategy, bool approved);
    event FccSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event FAssetAdapterUpdated(address indexed previousAdapter, address indexed newAdapter);
    event LiquidityBufferUpdated(uint16 previousBps, uint16 newBps);
    event FAssetDepositQueued(bytes32 indexed depositId, address indexed receiver);
    event FAssetDepositSettled(bytes32 indexed depositId, address indexed receiver, uint256 assets, uint256 shares);
    event EmergencyWithdrawal(address indexed strategy, uint256 assetsWithdrawn);

    /// @notice Authorized address for FCC/TEE rebalance attestations.
    address public fccSigner;

    /// @notice Adapter allowed to create and settle asynchronous FAsset deposits.
    address public fAssetAdapter;

    /// @notice Adapter currently holding the deployed capital, if any.
    address public activeStrategy;

    /// @notice Replay-protection counter for FCC payloads.
    uint256 public rebalanceNonce;

    /// @notice Time a valid FCC-signed rebalance was last executed.
    uint256 public teeLastActive;

    /// @notice Share of assets retained locally for immediate ERC-4626 withdrawals.
    uint16 public liquidityBufferBps;

    mapping(address strategy => bool approved) public approvedStrategies;
    mapping(bytes32 depositId => address receiver) public pendingDepositReceiver;
    mapping(bytes32 depositId => bool settled) public settledFAssetDeposits;

    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes a UUPS proxy instance.
     * @param asset_ FAsset used as the ERC-4626 underlying asset.
     * @param name_ FlareYield ERC-20 name.
     * @param symbol_ FlareYield ERC-20 symbol.
     * @param initialOwner DAO multi-sig controlling upgrades and emergency fallback.
     * @param fccSigner_ TEE attestation signer for rebalances.
     * @param fAssetAdapter_ Direct-mint adapter allowed to settle queued deposits.
     * @param liquidityBufferBps_ Portion of liquid assets not deployed on each rebalance.
     */
    function initialize(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        address initialOwner,
        address fccSigner_,
        address fAssetAdapter_,
        uint16 liquidityBufferBps_
    ) external initializer {
        if (address(asset_) == address(0) || initialOwner == address(0) || fccSigner_ == address(0)) {
            revert ZeroAddress();
        }
        if (liquidityBufferBps_ > MAX_BPS) revert InvalidLiquidityBuffer(liquidityBufferBps_);

        __ERC20_init(name_, symbol_);
        __ERC4626_init(asset_);
        __Ownable_init(initialOwner);
        __Pausable_init();

        fccSigner = fccSigner_;
        fAssetAdapter = fAssetAdapter_;
        liquidityBufferBps = liquidityBufferBps_;
        teeLastActive = block.timestamp;
    }

    /**
     * @notice Total FAssets owned by shareholders, including idle assets and the active strategy value.
     * @dev Queued FAsset deposits are deliberately excluded: they remain at `fAssetAdapter` until settlement.
     */
    function totalAssets() public view override returns (uint256) {
        uint256 idleAssets = IERC20(asset()).balanceOf(address(this));
        address strategy = activeStrategy;
        return strategy == address(0) ? idleAssets : idleAssets + IStrategyAdapter(strategy).totalValue();
    }

    /**
     * @inheritdoc ERC4626Upgradeable
     */
    function asset() public view override(ERC4626Upgradeable, IParentVault) returns (address) {
        return super.asset();
    }

    /// @notice Legacy-friendly alias for integrations built before the ERC-4626 upgrade.
    function totalUnderlyingValue() external view override returns (uint256) {
        return totalAssets();
    }

    /**
     * @inheritdoc ERC4626Upgradeable
     */
    function deposit(uint256 assets, address receiver)
        public
        override(ERC4626Upgradeable, IParentVault)
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        return super.deposit(assets, receiver);
    }

    /**
     * @inheritdoc ERC4626Upgradeable
     */
    function mint(uint256 shares, address receiver) public override whenNotPaused nonReentrant returns (uint256) {
        return super.mint(shares, receiver);
    }

    /**
     * @inheritdoc ERC4626Upgradeable
     */
    function withdraw(uint256 assets, address receiver, address owner)
        public
        override(ERC4626Upgradeable, IParentVault)
        nonReentrant
        returns (uint256)
    {
        return super.withdraw(assets, receiver, owner);
    }

    /**
     * @inheritdoc ERC4626Upgradeable
     */
    function redeem(uint256 shares, address receiver, address owner) public override nonReentrant returns (uint256) {
        return super.redeem(shares, receiver, owner);
    }

    /**
     * @notice Reserves an identifier for an FAsset direct-mint operation.
     * @dev No shares are minted until the FAsset system has minted the real, post-fee balance.
     */
    function queueFAssetDeposit(bytes32 depositId, address receiver) external override whenNotPaused {
        if (msg.sender != fAssetAdapter) revert UnauthorizedFAssetAdapter(msg.sender);
        if (receiver == address(0)) revert ZeroAddress();
        if (settledFAssetDeposits[depositId]) revert FAssetDepositAlreadySettled(depositId);
        if (pendingDepositReceiver[depositId] != address(0)) revert PendingDepositAlreadyExists(depositId);

        pendingDepositReceiver[depositId] = receiver;
        emit FAssetDepositQueued(depositId, receiver);
    }

    /**
     * @notice Settles a direct mint using the amount actually received after FAsset executor and minting fees.
     * @dev The FAsset adapter must approve this vault for exactly `assets`; this method pulls the assets and
     *      calculates shares before the transfer, preserving ERC-4626 pricing semantics.
     */
    function settleFAssetDeposit(bytes32 depositId, uint256 assets)
        external
        override
        whenNotPaused
        nonReentrant
        returns (uint256 shares)
    {
        if (msg.sender != fAssetAdapter) revert UnauthorizedFAssetAdapter(msg.sender);
        address receiver = pendingDepositReceiver[depositId];
        if (receiver == address(0)) revert UnknownPendingDeposit(depositId);

        delete pendingDepositReceiver[depositId];
        settledFAssetDeposits[depositId] = true;
        shares = previewDeposit(assets);
        _deposit(msg.sender, receiver, assets, shares);

        emit FAssetDepositSettled(depositId, receiver, assets, shares);
    }

    /**
     * @notice Executes a FCC-authorized strategy migration.
     * @dev The signature commits to a 24+ hour historical-yield observation window. The contract cannot prove
     *      off-chain APY provenance itself; that duty remains inside the TEE, while the signed declaration makes
     *      a spot-only observation rejectable on-chain.
     */
    function executeRebalance(RebalancePayload calldata payload) external override whenNotPaused nonReentrant {
        _validateRebalance(payload);

        address previousStrategy = activeStrategy;
        if (payload.newStrategy == previousStrategy) revert StrategyUnchanged();
        if (!approvedStrategies[payload.newStrategy]) revert StrategyNotApproved(payload.newStrategy);

        rebalanceNonce = payload.nonce + 1;

        uint256 assetsWithdrawn;
        if (previousStrategy != address(0)) {
            uint256 balanceBefore = IERC20(asset()).balanceOf(address(this));
            uint256 adapterReported = IStrategyAdapter(previousStrategy).withdrawAll(payload.minAmountOut);
            uint256 balanceAfter = IERC20(asset()).balanceOf(address(this));
            assetsWithdrawn = balanceAfter - balanceBefore;

            // Trust neither a strategy return value nor an ERC-20's behavior without checking the actual balance.
            if (assetsWithdrawn < payload.minAmountOut || adapterReported < payload.minAmountOut) {
                revert SlippageExceeded(payload.minAmountOut, assetsWithdrawn);
            }
            uint256 residualValue = IStrategyAdapter(previousStrategy).totalValue();
            if (residualValue != 0) revert StrategyNotFullyWithdrawn(previousStrategy, residualValue);
        }

        uint256 balanceToDeploy = IERC20(asset()).balanceOf(address(this));
        uint256 assetsToDeposit = (balanceToDeploy * (MAX_BPS - liquidityBufferBps)) / MAX_BPS;
        uint256 assetsDeposited;
        if (assetsToDeposit != 0) {
            IERC20(asset()).forceApprove(payload.newStrategy, assetsToDeposit);
            uint256 balanceBeforeDeposit = IERC20(asset()).balanceOf(address(this));
            uint256 adapterReported = IStrategyAdapter(payload.newStrategy).deposit(assetsToDeposit);
            uint256 balanceAfterDeposit = IERC20(asset()).balanceOf(address(this));
            IERC20(asset()).forceApprove(payload.newStrategy, 0);

            assetsDeposited = balanceBeforeDeposit - balanceAfterDeposit;
            if (assetsDeposited != assetsToDeposit || adapterReported != assetsToDeposit) {
                revert InvalidAdapterDeposit(assetsToDeposit, assetsDeposited);
            }
        }

        activeStrategy = payload.newStrategy;
        teeLastActive = block.timestamp;

        emit Rebalanced(previousStrategy, payload.newStrategy, assetsWithdrawn, assetsDeposited);
    }

    /**
     * @notice Pulls all capital out of the active strategy after FCC has been unavailable for seven days.
     * @dev `owner` is expected to be a DAO multi-sig. This operation does not transfer assets to the owner.
     */
    function forceWithdrawAll(uint256 minAmountOut) external onlyOwner nonReentrant returns (uint256 assetsWithdrawn) {
        uint256 availableAt = teeLastActive + TEE_TIMEOUT;
        if (block.timestamp <= availableAt) revert FallbackNotAvailable(availableAt);

        address strategy = activeStrategy;
        if (strategy == address(0)) return 0;

        uint256 balanceBefore = IERC20(asset()).balanceOf(address(this));
        uint256 adapterReported = IStrategyAdapter(strategy).withdrawAll(minAmountOut);
        uint256 balanceAfter = IERC20(asset()).balanceOf(address(this));
        assetsWithdrawn = balanceAfter - balanceBefore;
        if (assetsWithdrawn < minAmountOut || adapterReported < minAmountOut) {
            revert SlippageExceeded(minAmountOut, assetsWithdrawn);
        }
        uint256 residualValue = IStrategyAdapter(strategy).totalValue();
        if (residualValue != 0) revert StrategyNotFullyWithdrawn(strategy, residualValue);

        activeStrategy = address(0);
        emit EmergencyWithdrawal(strategy, assetsWithdrawn);
    }

    function setStrategyAdapter(address strategy, bool approved) external onlyOwner {
        if (strategy == address(0)) revert ZeroAddress();
        if (approved) {
            address strategyAsset = IStrategyAdapter(strategy).asset();
            if (strategyAsset != asset()) revert StrategyAssetMismatch(strategy, strategyAsset);
        } else if (strategy == activeStrategy) {
            revert StrategyUnchanged();
        }

        approvedStrategies[strategy] = approved;
        emit StrategyApprovalUpdated(strategy, approved);
    }

    function setFccSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        address previousSigner = fccSigner;
        fccSigner = newSigner;
        emit FccSignerUpdated(previousSigner, newSigner);
    }

    function setFAssetAdapter(address newAdapter) external onlyOwner {
        address previousAdapter = fAssetAdapter;
        fAssetAdapter = newAdapter;
        emit FAssetAdapterUpdated(previousAdapter, newAdapter);
    }

    function setLiquidityBufferBps(uint16 newBufferBps) external onlyOwner {
        if (newBufferBps > MAX_BPS) revert InvalidLiquidityBuffer(newBufferBps);
        uint16 previousBufferBps = liquidityBufferBps;
        liquidityBufferBps = newBufferBps;
        emit LiquidityBufferUpdated(previousBufferBps, newBufferBps);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice EIP-712 domain separator used for FCC rebalance attestations.
     */
    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    /**
     * @notice Digest a TEE signs for a rebalance. The `signature` field is intentionally excluded.
     */
    function rebalanceDigest(RebalancePayload calldata payload) external view returns (bytes32) {
        return _rebalanceDigest(payload);
    }

    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
    {
        uint256 idleAssets = IERC20(asset()).balanceOf(address(this));
        if (idleAssets < assets) {
            address strategy = activeStrategy;
            if (strategy == address(0)) revert InsufficientLiquidity(assets, idleAssets);

            uint256 shortfall = assets - idleAssets;
            uint256 actualAmountOut = IStrategyAdapter(strategy).withdraw(shortfall, shortfall);
            uint256 newIdleAssets = IERC20(asset()).balanceOf(address(this));
            if (actualAmountOut < shortfall || newIdleAssets < assets) {
                revert InsufficientLiquidity(assets, newIdleAssets);
            }
        }

        super._withdraw(caller, receiver, owner, assets, shares);
    }

    /// @dev Rejects fee-on-transfer behavior so every share mint is backed by the advertised FAsset amount.
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        uint256 balanceBefore = IERC20(asset()).balanceOf(address(this));
        super._deposit(caller, receiver, assets, shares);
        uint256 assetsReceived = IERC20(asset()).balanceOf(address(this)) - balanceBefore;
        if (assetsReceived != assets) revert UnexpectedAssetTransfer(assets, assetsReceived);
    }

    function _validateRebalance(RebalancePayload calldata payload) private view {
        if (payload.nonce != rebalanceNonce) revert InvalidNonce(rebalanceNonce, payload.nonce);
        if (block.timestamp > payload.deadline) revert RebalanceExpired(payload.deadline, block.timestamp);
        if (payload.twapEnd > block.timestamp || payload.twapEnd <= payload.twapStart) {
            revert InvalidTwapWindow(payload.twapStart, payload.twapEnd);
        }
        if (payload.twapEnd - payload.twapStart < MIN_TWAP_WINDOW) {
            revert InvalidTwapWindow(payload.twapStart, payload.twapEnd);
        }
        if (block.timestamp - payload.twapEnd > MAX_TWAP_AGE) {
            revert StaleTwap(payload.twapEnd, block.timestamp);
        }

        address recoveredSigner = ECDSA.recover(_rebalanceDigest(payload), payload.signature);
        if (recoveredSigner != fccSigner) revert InvalidTeeSignature(recoveredSigner);
    }

    function _rebalanceDigest(RebalancePayload calldata payload) private view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                REBALANCE_TYPEHASH,
                payload.newStrategy,
                payload.minAmountOut,
                payload.nonce,
                payload.deadline,
                payload.twapStart,
                payload.twapEnd,
                payload.strategyDataHash
            )
        );
        return MessageHashUtils.toTypedDataHash(domainSeparator(), structHash);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    uint256[42] private __gap;
}

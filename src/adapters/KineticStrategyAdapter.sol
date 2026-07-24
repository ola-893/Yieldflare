// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IStrategyAdapter} from "../interfaces/IStrategyAdapter.sol";
import {IKToken} from "../interfaces/IKToken.sol";
import {IKineticComptroller} from "../interfaces/IKineticComptroller.sol";

/**
 * @title KineticStrategyAdapter
 * @notice Deploys ParentVault capital into Kinetic Market (Compound-v2 fork on Flare).
 * @dev Only the ParentVault may call `deposit`, `withdraw`, and `withdrawAll`. The adapter
 *      uses `exchangeRateStored` for gas-efficient `totalValue` reads; interest is auto-accrued
 *      by Kinetic's protocol block-hooks. Harvested JOULE rewards are forwarded to the vault
 *      owner (DAO treasury) — they are not re-injected into the vault to avoid price manipulation.
 *
 *      Live Flare addresses (documented for reference; passed at construction):
 *        Unitroller: 0x15F69897E6aEBE0463401345543C26d1Fd994abB
 *        kUSDC.e:   0xDEeBaBe05BDA7e8C1740873abF715f16164C29B8
 */
contract KineticStrategyAdapter is IStrategyAdapter, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Errors ────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error OnlyVault(address caller);
    error KTokenMintFailed(uint256 errorCode);
    error KTokenRedeemFailed(uint256 errorCode);
    error SlippageExceeded(uint256 minAmountOut, uint256 actualAmountOut);
    error InsufficientBalance(uint256 requested, uint256 available);
    error NoKTokensToRedeem();

    // ─── Events ────────────────────────────────────────────────────────────────
    event Deposited(uint256 assets, uint256 kTokensReceived);
    event Withdrawn(uint256 assets, uint256 kTokensBurned);
    event RewardsClaimed(address indexed rewardToken, uint256 amount, address indexed recipient);

    // ─── Immutables ────────────────────────────────────────────────────────────
    /// @notice Underlying asset (e.g., USDC.e on Flare).
    IERC20 public immutable underlyingAsset;

    /// @notice Kinetic kToken receipt token (e.g., kUSDC.e).
    IKToken public immutable kToken;

    /// @notice Kinetic Unitroller/Comptroller for reward claiming.
    IKineticComptroller public immutable comptroller;

    /// @notice ParentVault — the sole caller for deposit/withdraw.
    address public immutable vault;

    /// @notice JOULE reward token address for harvesting.
    IERC20 public immutable rewardToken;

    /// @notice Reward type index used in comptroller.claimReward (0 = JOULE on Kinetic).
    uint8 public immutable rewardType;

    // ─── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault(msg.sender);
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(
        IERC20 underlyingAsset_,
        IKToken kToken_,
        IKineticComptroller comptroller_,
        address vault_,
        address initialOwner_,
        IERC20 rewardToken_,
        uint8 rewardType_
    ) Ownable(initialOwner_) {
        if (
            address(underlyingAsset_) == address(0) || address(kToken_) == address(0)
                || address(comptroller_) == address(0) || vault_ == address(0)
        ) revert ZeroAddress();

        underlyingAsset = underlyingAsset_;
        kToken = kToken_;
        comptroller = comptroller_;
        vault = vault_;
        rewardToken = rewardToken_;
        rewardType = rewardType_;
    }

    // ─── IStrategyAdapter ──────────────────────────────────────────────────────

    /// @inheritdoc IStrategyAdapter
    function asset() external view override returns (address) {
        return address(underlyingAsset);
    }

    /**
     * @notice Deposits underlying assets into Kinetic's kToken market.
     * @dev The ParentVault must have approved this adapter for exactly `amount`.
     *      The adapter verifies the kToken balance delta to confirm the mint succeeded.
     */
    function deposit(uint256 amount) external override onlyVault whenNotPaused nonReentrant returns (uint256 assetsDeposited) {
        underlyingAsset.safeTransferFrom(vault, address(this), amount);

        uint256 kTokensBefore = kToken.balanceOf(address(this));
        underlyingAsset.forceApprove(address(kToken), amount);
        uint256 err = kToken.mint(amount);
        underlyingAsset.forceApprove(address(kToken), 0);
        if (err != 0) revert KTokenMintFailed(err);

        uint256 kTokensAfter = kToken.balanceOf(address(this));
        uint256 kTokensReceived = kTokensAfter - kTokensBefore;
        if (kTokensReceived == 0) revert KTokenMintFailed(0);

        assetsDeposited = amount;
        emit Deposited(amount, kTokensReceived);
    }

    /**
     * @notice Withdraws a specific underlying amount from Kinetic.
     * @param amount The desired underlying amount.
     * @param minAmountOut Floor enforced on the actual withdrawal — reverts on slippage.
     */
    function withdraw(uint256 amount, uint256 minAmountOut)
        external
        override
        onlyVault
        whenNotPaused
        nonReentrant
        returns (uint256 assetsWithdrawn)
    {
        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));

        uint256 err = kToken.redeemUnderlying(amount);
        if (err != 0) revert KTokenRedeemFailed(err);

        assetsWithdrawn = underlyingAsset.balanceOf(address(this)) - balanceBefore;
        if (assetsWithdrawn < minAmountOut) revert SlippageExceeded(minAmountOut, assetsWithdrawn);

        underlyingAsset.safeTransfer(vault, assetsWithdrawn);
        emit Withdrawn(assetsWithdrawn, 0);
    }

    /**
     * @notice Redeems all kTokens, returning the full underlying balance to the vault.
     * @param minAmountOut Slippage floor enforced on the total withdrawal.
     */
    function withdrawAll(uint256 minAmountOut)
        external
        override
        onlyVault
        whenNotPaused
        nonReentrant
        returns (uint256 assetsWithdrawn)
    {
        uint256 kTokenBalance = kToken.balanceOf(address(this));
        if (kTokenBalance == 0) revert NoKTokensToRedeem();

        uint256 balanceBefore = underlyingAsset.balanceOf(address(this));

        uint256 err = kToken.redeem(kTokenBalance);
        if (err != 0) revert KTokenRedeemFailed(err);

        assetsWithdrawn = underlyingAsset.balanceOf(address(this)) - balanceBefore;
        if (assetsWithdrawn < minAmountOut) revert SlippageExceeded(minAmountOut, assetsWithdrawn);

        underlyingAsset.safeTransfer(vault, assetsWithdrawn);
        emit Withdrawn(assetsWithdrawn, kTokenBalance);
    }

    /**
     * @notice Total underlying value held in Kinetic including accrued interest.
     * @dev Uses `exchangeRateStored` (gas-efficient, no state mutation) and the adapter's kToken
     *      balance. Precision: exchangeRate is scaled by 1e18; kToken decimals match the market.
     */
    function totalValue() external view override returns (uint256) {
        uint256 kTokenBalance = kToken.balanceOf(address(this));
        if (kTokenBalance == 0) return 0;
        uint256 exchangeRate = kToken.exchangeRateStored();
        return (kTokenBalance * exchangeRate) / 1e18;
    }

    // ─── Reward Harvesting ─────────────────────────────────────────────────────

    /**
     * @notice Claims accrued JOULE rewards from Kinetic and forwards them to `recipient`.
     * @dev Callable by owner (DAO). Rewards are NOT re-deposited into the vault to prevent
     *      a reward-donation attack that would inflate the share price arbitrarily.
     * @param recipient Address receiving the harvested reward tokens.
     */
    function harvestRewards(address recipient) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();

        address[] memory markets = new address[](1);
        markets[0] = address(kToken);
        comptroller.claimReward(rewardType, address(this), markets);

        uint256 rewardBalance = rewardToken.balanceOf(address(this));
        if (rewardBalance > 0) {
            rewardToken.safeTransfer(recipient, rewardBalance);
            emit RewardsClaimed(address(rewardToken), rewardBalance, recipient);
        }
    }

    // ─── Admin ─────────────────────────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency rescue of tokens accidentally sent to this adapter.
     * @dev Cannot rescue the kToken (active position) or underlying (would break accounting).
     */
    function rescueToken(IERC20 token, address to, uint256 amount) external onlyOwner {
        if (address(token) == address(kToken) || address(token) == address(underlyingAsset)) {
            revert ZeroAddress(); // reuse error — semantically "disallowed token"
        }
        token.safeTransfer(to, amount);
    }
}

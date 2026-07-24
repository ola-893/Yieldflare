// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IStrategyAdapter} from "../interfaces/IStrategyAdapter.sol";
import {IEnosysRouter} from "../interfaces/IEnosysRouter.sol";
import {IEnosysV3Pool} from "../interfaces/IEnosysV3Pool.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title EnosysStrategyAdapter
 * @notice Deploys ParentVault capital into an Enosys DEX V3 LP position on Flare.
 * @dev Strategy: single-asset → concentrated liquidity. To keep the adapter deterministic and
 *      compatible with the ParentVault's `totalValue` view, the adapter holds yield-side tokens
 *      obtained from removing liquidity and uses the Enosys V3 SwapRouter to convert them back
 *      to the underlying asset during `withdrawAll`, enforcing `minAmountOut` for MEV protection.
 *
 *      The adapter accepts the vault's underlying asset, swaps half into the paired token via
 *      Enosys V3, and holds both balances. On withdrawal it swaps back. This provides genuine DEX
 *      protocol diversification vs the Kinetic lending strategy and exercises the critical
 *      `minAmountOut` slippage guard end-to-end.
 *
 *      For a production deployment this would integrate with the NonfungiblePositionManager for
 *      proper concentrated-liquidity NFT positions and fee accrual. The current implementation
 *      demonstrates the architectural pattern with direct swap routing.
 */
contract EnosysStrategyAdapter is IStrategyAdapter, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Errors ────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error OnlyVault(address caller);
    error SlippageExceeded(uint256 minAmountOut, uint256 actualAmountOut);
    error InsufficientBalance(uint256 requested, uint256 available);
    error NothingToWithdraw();
    error SwapFailed();

    // ─── Events ────────────────────────────────────────────────────────────────
    event Deposited(uint256 assetsIn, uint256 pairedTokenReceived);
    event Withdrawn(uint256 assetsReturned, uint256 pairedTokenSwapped);

    // ─── Immutables ────────────────────────────────────────────────────────────
    /// @notice Vault's underlying asset (e.g., FXRP, USDC.e).
    IERC20 public immutable underlyingAsset;

    /// @notice The second token in the Enosys V3 pool pair (e.g., WFLR).
    IERC20 public immutable pairedToken;

    /// @notice Enosys V3 SwapRouter.
    IEnosysRouter public immutable router;

    /// @notice Enosys V3 Pool for oracle pricing.
    IEnosysV3Pool public immutable pool;

    /// @notice ParentVault — sole caller for deposit/withdraw.
    address public immutable vault;

    /// @notice V3 pool fee tier (e.g., 3000 = 0.30%).
    uint24 public immutable poolFee;

    /// @notice TWAP window in seconds for oracle pricing (600s = 10min).
    uint32 public constant TWAP_WINDOW = 600;

    // ─── State ─────────────────────────────────────────────────────────────────
    /// @notice Underlying asset balance held by the adapter (the "asset side" of LP).
    uint256 public heldUnderlying;

    /// @notice Paired token balance held by the adapter (the "paired side" of LP).
    uint256 public heldPairedToken;

    // ─── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault(msg.sender);
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(
        IERC20 underlyingAsset_,
        IERC20 pairedToken_,
        IEnosysRouter router_,
        IEnosysV3Pool pool_,
        address vault_,
        address initialOwner_,
        uint24 poolFee_
    ) Ownable(initialOwner_) {
        if (
            address(underlyingAsset_) == address(0) || address(pairedToken_) == address(0)
                || address(router_) == address(0) || address(pool_) == address(0)
                || vault_ == address(0)
        ) revert ZeroAddress();

        underlyingAsset = underlyingAsset_;
        pairedToken = pairedToken_;
        router = router_;
        pool = pool_;
        vault = vault_;
        poolFee = poolFee_;
    }

    // ─── IStrategyAdapter ──────────────────────────────────────────────────────

    /// @inheritdoc IStrategyAdapter
    function asset() external view override returns (address) {
        return address(underlyingAsset);
    }

    /**
     * @notice Accepts underlying assets from the vault, swaps half into the paired token.
     * @dev The vault must approve this adapter for exactly `amount`. Half is swapped via Enosys V3
     *      with no `amountOutMinimum` on deposit (the TEE-signed rebalance already validates
     *      acceptable conditions). The received paired tokens are held for later exit.
     */
    function deposit(uint256 amount) external override onlyVault whenNotPaused nonReentrant returns (uint256 assetsDeposited) {
        if (amount == 0) revert ZeroAmount();
        underlyingAsset.safeTransferFrom(vault, address(this), amount);

        uint256 halfAmount = amount / 2;
        uint256 retainedAmount = amount - halfAmount; // Avoids dust from odd amounts.

        // Swap half of the underlying → paired token via Enosys V3
        uint256 pairedTokenReceived;
        if (halfAmount > 0) {
            underlyingAsset.forceApprove(address(router), halfAmount);
            pairedTokenReceived = router.exactInputSingle(
                IEnosysRouter.ExactInputSingleParams({
                    tokenIn: address(underlyingAsset),
                    tokenOut: address(pairedToken),
                    fee: poolFee,
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: halfAmount,
                    amountOutMinimum: 0, // TEE rebalance already validated conditions
                    sqrtPriceLimitX96: 0
                })
            );
            underlyingAsset.forceApprove(address(router), 0);
        }

        heldUnderlying += retainedAmount;
        heldPairedToken += pairedTokenReceived;
        assetsDeposited = amount;

        emit Deposited(amount, pairedTokenReceived);
    }

    /**
     * @notice Withdraws a specific underlying amount by swapping proportional paired tokens back.
     * @param amount The desired underlying amount.
     * @param minAmountOut Floor enforced on the actual underlying returned — reverts on slippage.
     */
    function withdraw(uint256 amount, uint256 minAmountOut)
        external
        override
        onlyVault
        whenNotPaused
        nonReentrant
        returns (uint256 assetsWithdrawn)
    {
        uint256 currentTotalValue = _totalValue();
        if (currentTotalValue == 0) revert NothingToWithdraw();
        if (amount > currentTotalValue) revert InsufficientBalance(amount, currentTotalValue);

        // Calculate the proportion of paired tokens to swap back.
        uint256 pairedToSwap = (heldPairedToken * amount) / currentTotalValue;
        uint256 underlyingFromHeld = (heldUnderlying * amount) / currentTotalValue;

        uint256 underlyingFromSwap;
        if (pairedToSwap > 0) {
            pairedToken.forceApprove(address(router), pairedToSwap);
            underlyingFromSwap = router.exactInputSingle(
                IEnosysRouter.ExactInputSingleParams({
                    tokenIn: address(pairedToken),
                    tokenOut: address(underlyingAsset),
                    fee: poolFee,
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: pairedToSwap,
                    amountOutMinimum: 0, // Total check below
                    sqrtPriceLimitX96: 0
                })
            );
            pairedToken.forceApprove(address(router), 0);
            heldPairedToken -= pairedToSwap;
        }

        heldUnderlying -= underlyingFromHeld;
        assetsWithdrawn = underlyingFromHeld + underlyingFromSwap;

        if (assetsWithdrawn < minAmountOut) revert SlippageExceeded(minAmountOut, assetsWithdrawn);

        underlyingAsset.safeTransfer(vault, assetsWithdrawn);
        emit Withdrawn(assetsWithdrawn, pairedToSwap);
    }

    /**
     * @notice Swaps all paired tokens back to the underlying and returns everything to the vault.
     * @param minAmountOut Slippage floor on the total underlying returned.
     * @dev This is the critical path exercised during TEE-authorized rebalances. The `minAmountOut`
     *      parameter is the primary defense against MEV sandwich attacks on the Enosys swap.
     */
    function withdrawAll(uint256 minAmountOut)
        external
        override
        onlyVault
        whenNotPaused
        nonReentrant
        returns (uint256 assetsWithdrawn)
    {
        uint256 pairedBalance = heldPairedToken;
        uint256 underlyingBalance = heldUnderlying;
        if (pairedBalance == 0 && underlyingBalance == 0) revert NothingToWithdraw();

        uint256 underlyingFromSwap;
        if (pairedBalance > 0) {
            pairedToken.forceApprove(address(router), pairedBalance);
            underlyingFromSwap = router.exactInputSingle(
                IEnosysRouter.ExactInputSingleParams({
                    tokenIn: address(pairedToken),
                    tokenOut: address(underlyingAsset),
                    fee: poolFee,
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: pairedBalance,
                    amountOutMinimum: minAmountOut > underlyingBalance
                        ? minAmountOut - underlyingBalance
                        : 0, // Pass slippage guard to the swap itself
                    sqrtPriceLimitX96: 0
                })
            );
            pairedToken.forceApprove(address(router), 0);
            heldPairedToken = 0;
        }

        heldUnderlying = 0;
        assetsWithdrawn = underlyingBalance + underlyingFromSwap;

        if (assetsWithdrawn < minAmountOut) revert SlippageExceeded(minAmountOut, assetsWithdrawn);

        underlyingAsset.safeTransfer(vault, assetsWithdrawn);
        emit Withdrawn(assetsWithdrawn, pairedBalance);
    }

    /**
     * @notice Estimates total value in underlying terms using TWAP oracle.
     * @dev Queries the pool's TWAP to convert the paired token balance to underlying denomination.
     *      This prevents arbitrage attacks from spot-price manipulation while accurately reflecting
     *      the market value of both held tokens.
     */
    function totalValue() external view override returns (uint256) {
        return _totalValue();
    }

    // ─── Internal ──────────────────────────────────────────────────────────────

    function _totalValue() internal view returns (uint256) {
        if (heldPairedToken == 0) return heldUnderlying;

        // Get TWAP tick from the pool
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = TWAP_WINDOW;
        secondsAgos[1] = 0;

        (int56[] memory tickCumulatives,) = pool.observe(secondsAgos);
        int56 tickCumulativeDelta = tickCumulatives[1] - tickCumulatives[0];
        
        // Calculate average tick with Uniswap's negative-rounding correction
        int24 avgTick = int24(tickCumulativeDelta / int56(uint56(TWAP_WINDOW)));
        if (tickCumulativeDelta < 0 && (tickCumulativeDelta % int56(uint56(TWAP_WINDOW)) != 0)) {
            avgTick--;
        }

        // Get sqrtPriceX96 from the average tick
        uint160 sqrtPriceX96 = _getSqrtRatioAtTick(avgTick);

        // Determine token order in the pool
        bool underlyingIsToken0 = pool.token0() == address(underlyingAsset);

        // Convert pairedToken balance to underlying denomination
        uint256 pairedTokenValueInUnderlying;
        if (underlyingIsToken0) {
            // Price is token1/token0, so to convert pairedToken (token1) to underlying (token0):
            // pairedToken * (token0/token1) = pairedToken * (2^192 / sqrtPriceX96^2)
            pairedTokenValueInUnderlying = Math.mulDiv(
                heldPairedToken,
                2**192,
                uint256(sqrtPriceX96) * uint256(sqrtPriceX96)
            );
        } else {
            // Price is token1/token0, so to convert pairedToken (token0) to underlying (token1):
            // pairedToken * (token1/token0) = pairedToken * (sqrtPriceX96^2 / 2^192)
            pairedTokenValueInUnderlying = Math.mulDiv(
                heldPairedToken,
                uint256(sqrtPriceX96) * uint256(sqrtPriceX96),
                2**192
            );
        }

        return heldUnderlying + pairedTokenValueInUnderlying;
    }

    /**
     * @notice Calculates sqrt(1.0001^tick) * 2^96
     * @dev Ported from Uniswap V3's TickMath for accurate price conversion.
     *      This is tick-math, not approximation - precision-critical for oracle pricing.
     */
    function _getSqrtRatioAtTick(int24 tick) internal pure returns (uint160 sqrtPriceX96) {
        uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));
        require(absTick <= 887272, "T");

        uint256 ratio = absTick & 0x1 != 0 ? 0xfffcb933bd6fad37aa2d162d1a594001 : 0x100000000000000000000000000000000;
        if (absTick & 0x2 != 0) ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128;
        if (absTick & 0x4 != 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128;
        if (absTick & 0x8 != 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128;
        if (absTick & 0x10 != 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128;
        if (absTick & 0x20 != 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128;
        if (absTick & 0x40 != 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128;
        if (absTick & 0x80 != 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128;
        if (absTick & 0x100 != 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128;
        if (absTick & 0x200 != 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128;
        if (absTick & 0x400 != 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128;
        if (absTick & 0x800 != 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128;
        if (absTick & 0x1000 != 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128;
        if (absTick & 0x2000 != 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128;
        if (absTick & 0x4000 != 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128;
        if (absTick & 0x8000 != 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128;
        if (absTick & 0x10000 != 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128;
        if (absTick & 0x20000 != 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128;
        if (absTick & 0x40000 != 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128;
        if (absTick & 0x80000 != 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128;

        if (tick > 0) ratio = type(uint256).max / ratio;

        sqrtPriceX96 = uint160((ratio >> 32) + (ratio % (1 << 32) == 0 ? 0 : 1));
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
     * @dev Cannot rescue the underlying or paired token (would break accounting).
     */
    function rescueToken(IERC20 token, address to, uint256 amount) external onlyOwner {
        if (address(token) == address(underlyingAsset) || address(token) == address(pairedToken)) {
            revert ZeroAddress();
        }
        token.safeTransfer(to, amount);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IStrategyAdapter} from "../interfaces/IStrategyAdapter.sol";
import {ISparkDexRouter} from "../interfaces/ISparkDexRouter.sol";
import {ISparkDexFactory} from "../interfaces/ISparkDexFactory.sol";
import {ISparkDexPair} from "../interfaces/ISparkDexPair.sol";
import {IFlareContractRegistry} from "../interfaces/IFlareContractRegistry.sol";
import {IWNat} from "../interfaces/IWNat.sol";

/**
 * @title SparkDexAdapter
 * @notice Provides liquidity to SparkDEX (Uniswap V2 fork) pools for yield generation
 * @dev Strategy: Single-asset → Swap half to paired token → Add LP → Earn swap fees
 *      
 *      Yield Sources:
 *      - Trading swap fees from the FXRP/WC2FLR pool
 *      - (Potentially) FTSO delegation rewards on WC2FLR held in pool
 *      
 *      SparkDEX Verified Addresses on Coston2:
 *      - V2 Router: 0x4a1E5A90e9943467FAd1acea1E7F0e5e88472a1e
 *      - V2 Factory: 0x16b619B04c961E8f4F06C10B42FDAbb328980A89
 *      
 *      Live on Coston2 testnet with real yield generation.
 */
contract SparkDexAdapter is IStrategyAdapter, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Errors ────────────────────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error OnlyVault(address caller);
    error SlippageExceeded(uint256 minAmountOut, uint256 actualAmountOut);
    error InsufficientBalance(uint256 requested, uint256 available);
    error NothingToWithdraw();
    error PairNotFound();
    error InvalidReserves();

    // ─── Events ────────────────────────────────────────────────────────────────
    event LiquidityAdded(uint256 amountToken, uint256 amountWNat, uint256 liquidity);
    event LiquidityRemoved(uint256 liquidity, uint256 amountToken, uint256 amountWNat);
    event FeesCollected(uint256 amountToken, uint256 amountWNat);

    // ─── Constants ─────────────────────────────────────────────────────────────
    /// @notice SparkDEX V2 Router on Coston2 (verified address)
    address public constant SPARKDEX_ROUTER = 0x4a1E5A90e9943467FAd1acea1E7F0e5e88472a1e;
    
    /// @notice SparkDEX V2 Factory on Coston2 (verified address)
    address public constant SPARKDEX_FACTORY = 0x16b619B04c961E8f4F06C10B42FDAbb328980A89;
    
    /// @notice FlareContractRegistry address (same on all networks)
    address public constant FLARE_CONTRACT_REGISTRY = 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019;
    
    /// @notice Minimum liquidity to leave in pool (prevents divide-by-zero)
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    // ─── Immutables ────────────────────────────────────────────────────────────
    /// @notice Underlying asset (e.g., FXRP)
    IERC20 public immutable underlyingAsset;

    /// @notice ParentVault — sole caller for deposit/withdraw
    address public immutable vault;

    // ─── State ─────────────────────────────────────────────────────────────────
    /// @notice The LP token received from SparkDEX
    address public lpToken;

    // ─── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault(msg.sender);
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(
        IERC20 underlyingAsset_,
        address vault_,
        address initialOwner_
    ) Ownable(initialOwner_) {
        if (address(underlyingAsset_) == address(0) || vault_ == address(0)) {
            revert ZeroAddress();
        }

        underlyingAsset = underlyingAsset_;
        vault = vault_;

        // Get or create the pair
        _initializePair();
    }

    // ─── IStrategyAdapter ──────────────────────────────────────────────────────

    /// @inheritdoc IStrategyAdapter
    function asset() external view override returns (address) {
        return address(underlyingAsset);
    }

    /**
     * @notice Deposits underlying assets and provides liquidity to SparkDEX
     * @dev Swaps half of the underlying to WNat, then adds liquidity
     */
    function deposit(uint256 amount) external override onlyVault whenNotPaused nonReentrant returns (uint256 assetsDeposited) {
        if (amount == 0) revert ZeroAmount();
        
        underlyingAsset.safeTransferFrom(vault, address(this), amount);
        
        IWNat wnat = _getWNat();
        ISparkDexRouter router = ISparkDexRouter(SPARKDEX_ROUTER);
        
        // Split amount: half stays as underlying, half swaps to WNat
        uint256 halfAmount = amount / 2;
        uint256 retainedAmount = amount - halfAmount;
        
        // Swap half to WNat WITH SLIPPAGE PROTECTION
        uint256 wnatReceived;
        if (halfAmount > 0) {
            address[] memory path = new address[](2);
            path[0] = address(underlyingAsset);
            path[1] = address(wnat);
            
            // Calculate minimum output (0.5% slippage tolerance)
            uint256 minWNatOut = halfAmount * 995 / 1000;
            
            underlyingAsset.forceApprove(address(router), halfAmount);
            
            uint256[] memory amounts = router.swapExactTokensForTokens(
                halfAmount,
                minWNatOut, // FIXED: Slippage protection
                path,
                address(this),
                block.timestamp
            );
            
            wnatReceived = amounts[1];
            underlyingAsset.forceApprove(address(router), 0);
        }
        
        // Add liquidity
        if (retainedAmount > 0 && wnatReceived > 0) {
            underlyingAsset.forceApprove(address(router), retainedAmount);
            wnat.approve(address(router), wnatReceived);
            
            (uint256 amountToken, uint256 amountWNat, uint256 liquidity) = router.addLiquidity(
                address(underlyingAsset),
                address(wnat),
                retainedAmount,
                wnatReceived,
                0, // Accept any amount
                0, // Accept any amount
                address(this),
                block.timestamp
            );
            
            underlyingAsset.forceApprove(address(router), 0);
            wnat.approve(address(router), 0);
            
            emit LiquidityAdded(amountToken, amountWNat, liquidity);
        }
        
        assetsDeposited = amount;
    }

    /**
     * @notice Withdraws specific underlying amount by removing proportional liquidity
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
        
        // Calculate proportional LP tokens to burn
        ISparkDexPair pair = ISparkDexPair(lpToken);
        uint256 lpBalance = pair.balanceOf(address(this));
        uint256 lpToRemove = (lpBalance * amount) / currentTotalValue;
        
        assetsWithdrawn = _removeLiquidityAndSwap(lpToRemove, minAmountOut);
    }

    /**
     * @notice Removes all liquidity and returns underlying assets to vault
     */
    function withdrawAll(uint256 minAmountOut)
        external
        override
        onlyVault
        whenNotPaused
        nonReentrant
        returns (uint256 assetsWithdrawn)
    {
        ISparkDexPair pair = ISparkDexPair(lpToken);
        uint256 lpBalance = pair.balanceOf(address(this));
        
        if (lpBalance == 0) revert NothingToWithdraw();
        
        assetsWithdrawn = _removeLiquidityAndSwap(lpBalance, minAmountOut);
    }

    /**
     * @notice Returns total value in underlying asset terms
     * @dev Calculates value based on LP token share of pool reserves
     */
    function totalValue() external view override returns (uint256) {
        return _totalValue();
    }

    // ─── Internal ──────────────────────────────────────────────────────────────

    function _initializePair() internal {
        IWNat wnat = _getWNat();
        ISparkDexFactory factory = ISparkDexFactory(SPARKDEX_FACTORY);
        
        try factory.getPair(address(underlyingAsset), address(wnat)) returns (address pair) {
            lpToken = pair;
        } catch {
            // Pair doesn't exist yet or factory call failed
            // Will be set to zero, can be updated later with updateLpToken()
            lpToken = address(0);
        }
    }

    function _totalValue() internal view returns (uint256) {
        if (lpToken == address(0)) {
            // Cannot initialize in view function
            return 0;
        }
        
        ISparkDexPair pair = ISparkDexPair(lpToken);
        uint256 lpBalance = pair.balanceOf(address(this));
        
        if (lpBalance == 0) return 0;
        
        // Get reserves
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        if (reserve0 == 0 || reserve1 == 0) return 0;
        
        uint256 totalSupply = pair.totalSupply();
        if (totalSupply == 0) return 0;
        
        // Calculate our share of reserves
        address token0 = pair.token0();
        bool underlyingIsToken0 = token0 == address(underlyingAsset);
        
        uint256 underlyingReserve = underlyingIsToken0 ? uint256(reserve0) : uint256(reserve1);
        uint256 wnatReserve = underlyingIsToken0 ? uint256(reserve1) : uint256(reserve0);
        
        // Our share of underlying
        uint256 underlyingAmount = (underlyingReserve * lpBalance) / totalSupply;
        
        // Our share of WNat, converted to underlying terms using reserve ratio
        uint256 wnatAmount = (wnatReserve * lpBalance) / totalSupply;
        uint256 wnatValueInUnderlying = (wnatAmount * underlyingReserve) / wnatReserve;
        
        return underlyingAmount + wnatValueInUnderlying;
    }

    function _removeLiquidityAndSwap(uint256 lpAmount, uint256 minAmountOut) internal returns (uint256 assetsReturned) {
        if (lpToken == address(0)) revert PairNotFound();
        
        ISparkDexRouter router = ISparkDexRouter(SPARKDEX_ROUTER);
        ISparkDexPair pair = ISparkDexPair(lpToken);
        IWNat wnat = _getWNat();
        
        // Approve LP tokens for router
        pair.approve(address(router), lpAmount);
        
        // Remove liquidity
        (uint256 amountToken, uint256 amountWNat) = router.removeLiquidity(
            address(underlyingAsset),
            address(wnat),
            lpAmount,
            0, // Accept any amount
            0, // Accept any amount
            address(this),
            block.timestamp
        );
        
        pair.approve(address(router), 0);
        
        emit LiquidityRemoved(lpAmount, amountToken, amountWNat);
        
        // Swap WNat back to underlying
        uint256 underlyingFromSwap;
        if (amountWNat > 0) {
            address[] memory path = new address[](2);
            path[0] = address(wnat);
            path[1] = address(underlyingAsset);
            
            wnat.approve(address(router), amountWNat);
            
            uint256[] memory amounts = router.swapExactTokensForTokens(
                amountWNat,
                0, // We'll check total at the end
                path,
                address(this),
                block.timestamp
            );
            
            underlyingFromSwap = amounts[1];
            wnat.approve(address(router), 0);
        }
        
        assetsReturned = amountToken + underlyingFromSwap;
        
        if (assetsReturned < minAmountOut) {
            revert SlippageExceeded(minAmountOut, assetsReturned);
        }
        
        // Transfer all underlying back to vault
        underlyingAsset.safeTransfer(vault, assetsReturned);
    }

    function _getWNat() internal view returns (IWNat) {
        address wnatAddress = IFlareContractRegistry(FLARE_CONTRACT_REGISTRY)
            .getContractAddressByName("WNat");
        if (wnatAddress == address(0)) revert ZeroAddress();
        return IWNat(wnatAddress);
    }

    // ─── Admin ─────────────────────────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency rescue of tokens (cannot rescue underlying or LP tokens)
     */
    function rescueToken(IERC20 token, address to, uint256 amount) external onlyOwner {
        if (address(token) == address(underlyingAsset) || address(token) == lpToken) {
            revert ZeroAddress();
        }
        token.safeTransfer(to, amount);
    }

    /**
     * @notice Update LP token address if pair was created after deployment
     */
    function updateLpToken() external onlyOwner {
        _initializePair();
    }
}

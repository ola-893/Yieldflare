// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {EnosysStrategyAdapter} from "../src/adapters/EnosysStrategyAdapter.sol";
import {ParentVault} from "../src/core/ParentVault.sol";
import {IParentVault} from "../src/interfaces/IParentVault.sol";
import {IEnosysRouter} from "../src/interfaces/IEnosysRouter.sol";
import {IEnosysV3Pool} from "../src/interfaces/IEnosysV3Pool.sol";

// ─── Test helpers (protocol stubs for the test harness) ────────────────────

contract TestAsset is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Simulates an Enosys V3 SwapRouter with a configurable exchange rate.
///      This allows testing the adapter's slippage enforcement and swap logic
///      without requiring a live Flare fork.
contract TestEnosysV3Pool is IEnosysV3Pool {
    address public immutable override token0;
    address public immutable override token1;
    int56 public mockTickCumulativeDelta;

    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
    }

    function observe(uint32[] calldata secondsAgos)
        external
        view
        override
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        tickCumulatives = new int56[](2);
        tickCumulatives[0] = 0;
        tickCumulatives[1] = mockTickCumulativeDelta;
        
        secondsPerLiquidityCumulativeX128s = new uint160[](2);
    }
    
    function slot0() external view override returns (uint160, int24, uint16, uint16, uint16, uint8, bool) {
        return (0, 0, 0, 0, 0, 0, false);
    }

    function setMockTickDelta(int56 delta) external {
        mockTickCumulativeDelta = delta;
    }
}

contract TestEnosysRouter is IEnosysRouter {
    using SafeERC20 for IERC20;

    /// @notice Swap rate scaled by 1e18. 1e18 = 1:1 parity.
    uint256 public swapRate = 1e18;

    /// @notice If true, the next swap will revert (simulates pool failure).
    bool public shouldFail;

    function setSwapRate(uint256 rate) external {
        swapRate = rate;
    }

    function setFail(bool fail) external {
        shouldFail = fail;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        require(!shouldFail, "TestRouter: swap failed");
        require(params.amountIn > 0, "TestRouter: zero amountIn");

        // Pull tokenIn
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);

        // Calculate amountOut using the configured rate
        amountOut = (params.amountIn * swapRate) / 1e18;
        require(amountOut >= params.amountOutMinimum, "TestRouter: slippage");

        // Mint/transfer tokenOut to recipient
        TestAsset(params.tokenOut).mint(params.recipient, amountOut);
    }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

contract EnosysStrategyAdapterTest is Test {
    address private constant DAO = address(0xDA0);
    uint256 private constant ONE = 1e18;
    uint24 private constant POOL_FEE = 3000; // 0.30%

    TestAsset private underlying; // e.g. FXRP
    TestAsset private pairedToken; // e.g. WFLR
    TestEnosysRouter private router;
    TestEnosysV3Pool private pool;
    ParentVault private vault;
    EnosysStrategyAdapter private adapter;

    function setUp() public {
        underlying = new TestAsset("Test FXRP", "FXRP");
        pairedToken = new TestAsset("Wrapped FLR", "WFLR");
        router = new TestEnosysRouter();
        pool = new TestEnosysV3Pool(address(underlying), address(pairedToken));

        // Deploy upgradeable ParentVault
        ParentVault impl = new ParentVault();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(
                ParentVault.initialize,
                (IERC20(underlying), "FlareYield", "FYD", address(this), address(0xFCC), address(0), uint16(0))
            )
        );
        vault = ParentVault(address(proxy));

        adapter = new EnosysStrategyAdapter(
            IERC20(underlying), IERC20(pairedToken), IEnosysRouter(address(router)), IEnosysV3Pool(address(pool)), address(vault), DAO, POOL_FEE
        );

        vault.setStrategyAdapter(address(adapter), true);
    }

    // ─── Access Control ────────────────────────────────────────────────────

    function test_OnlyVaultCanDeposit() public {
        underlying.mint(address(this), 100 * ONE);
        underlying.approve(address(adapter), 100 * ONE);

        vm.expectRevert(abi.encodeWithSelector(EnosysStrategyAdapter.OnlyVault.selector, address(this)));
        adapter.deposit(100 * ONE);
    }

    function test_OnlyVaultCanWithdraw() public {
        vm.expectRevert(abi.encodeWithSelector(EnosysStrategyAdapter.OnlyVault.selector, address(this)));
        adapter.withdraw(50 * ONE, 50 * ONE);
    }

    function test_OnlyVaultCanWithdrawAll() public {
        vm.expectRevert(abi.encodeWithSelector(EnosysStrategyAdapter.OnlyVault.selector, address(this)));
        adapter.withdrawAll(0);
    }

    // ─── Deposit ───────────────────────────────────────────────────────────

    function test_DepositSplitsAndSwaps() public {
        _depositViaVault(1000 * ONE);

        // 1000 deposited → 500 retained as underlying, 500 swapped at 1:1 → 500 pairedToken
        assertEq(adapter.heldUnderlying(), 500 * ONE, "should retain half as underlying");
        assertEq(adapter.heldPairedToken(), 500 * ONE, "should swap half to paired token");
        assertEq(adapter.totalValue(), 1000 * ONE, "totalValue should reflect full deposit");
    }

    function test_DepositHandlesOddAmounts() public {
        // 999e18 → halfAmount = 999e18/2 = 499.5e18, retainedAmount = 999e18 - 499.5e18 = 499.5e18
        _depositViaVault(999 * ONE);

        uint256 halfAmount = (999 * ONE) / 2; // 499.5e18
        uint256 retainedAmount = (999 * ONE) - halfAmount; // 499.5e18
        assertEq(adapter.heldUnderlying(), retainedAmount, "retained amount equals input minus half");
        assertEq(adapter.heldPairedToken(), halfAmount, "swap amount equals half");
        assertEq(adapter.totalValue(), 999 * ONE, "totalValue correct for odd input");
    }

    function test_DepositRevertsOnZero() public {
        vm.prank(address(vault));
        vm.expectRevert(EnosysStrategyAdapter.ZeroAmount.selector);
        adapter.deposit(0);
    }

    // ─── WithdrawAll ───────────────────────────────────────────────────────

    function test_WithdrawAllReturnsFullBalance() public {
        _depositViaVault(1000 * ONE);

        uint256 vaultBefore = underlying.balanceOf(address(vault));

        vm.prank(address(vault));
        uint256 withdrawn = adapter.withdrawAll(999 * ONE);

        assertEq(withdrawn, 1000 * ONE, "should return full value at 1:1 rate");
        assertEq(adapter.totalValue(), 0, "nothing should remain");
        assertEq(adapter.heldUnderlying(), 0, "heldUnderlying zeroed");
        assertEq(adapter.heldPairedToken(), 0, "heldPairedToken zeroed");
        assertEq(underlying.balanceOf(address(vault)), vaultBefore + 1000 * ONE, "vault received assets");
    }

    function test_WithdrawAllRevertsOnSlippage() public {
        _depositViaVault(1000 * ONE);

        // Set adverse swap rate: paired→underlying only returns 0.5:1
        router.setSwapRate(0.5e18);

        vm.prank(address(vault));
        vm.expectRevert(); // SlippageExceeded — exact args depend on swap outcome
        adapter.withdrawAll(999 * ONE);
    }

    function test_WithdrawAllPassesMinAmountOutToRouter() public {
        _depositViaVault(1000 * ONE);

        // Set swap rate that yields exactly 500 from the 500 paired tokens
        router.setSwapRate(1e18);

        vm.prank(address(vault));
        uint256 withdrawn = adapter.withdrawAll(1000 * ONE);
        assertEq(withdrawn, 1000 * ONE, "exact minAmountOut should pass");
    }

    function test_WithdrawAllWithFavorableRate() public {
        _depositViaVault(1000 * ONE);

        // Favorable swap rate: paired→underlying returns 1.2:1 (price appreciation)
        router.setSwapRate(1.2e18);

        vm.prank(address(vault));
        uint256 withdrawn = adapter.withdrawAll(1000 * ONE);

        // 500 underlying + 500 paired * 1.2 = 500 + 600 = 1100
        assertEq(withdrawn, 1100 * ONE, "should capture favorable rate");
    }

    // ─── Partial Withdraw ──────────────────────────────────────────────────

    function test_PartialWithdrawProportional() public {
        _depositViaVault(1000 * ONE);

        vm.prank(address(vault));
        uint256 withdrawn = adapter.withdraw(500 * ONE, 499 * ONE);

        assertEq(withdrawn, 500 * ONE, "should withdraw proportional amount");
        assertEq(adapter.heldUnderlying(), 250 * ONE, "half of remaining underlying");
        assertEq(adapter.heldPairedToken(), 250 * ONE, "half of remaining paired");
        assertEq(adapter.totalValue(), 500 * ONE, "half remains");
    }

    function test_PartialWithdrawRevertsOnSlippage() public {
        _depositViaVault(1000 * ONE);

        router.setSwapRate(0.1e18); // Terrible rate

        vm.prank(address(vault));
        vm.expectRevert();
        adapter.withdraw(500 * ONE, 500 * ONE);
    }

    function test_WithdrawRevertsWhenEmpty() public {
        vm.prank(address(vault));
        vm.expectRevert(EnosysStrategyAdapter.NothingToWithdraw.selector);
        adapter.withdrawAll(0);
    }

    function test_WithdrawRevertsOnInsufficientBalance() public {
        _depositViaVault(100 * ONE);

        vm.prank(address(vault));
        vm.expectRevert(abi.encodeWithSelector(EnosysStrategyAdapter.InsufficientBalance.selector, 200 * ONE, 100 * ONE));
        adapter.withdraw(200 * ONE, 200 * ONE);
    }

    // ─── TotalValue ────────────────────────────────────────────────────────

    function test_TotalValueZeroWhenEmpty() public view {
        assertEq(adapter.totalValue(), 0);
    }

    function test_TotalValueAfterMultipleDeposits() public {
        _depositViaVault(500 * ONE);
        _depositViaVault(300 * ONE);

        assertEq(adapter.totalValue(), 800 * ONE, "cumulative deposits tracked");
    }

    // ─── Pause ─────────────────────────────────────────────────────────────

    function test_PausePreventsDeposit() public {
        vm.prank(DAO);
        adapter.pause();

        vm.prank(address(vault));
        vm.expectRevert();
        adapter.deposit(100 * ONE);
    }

    function test_PausePreventsWithdrawAll() public {
        _depositViaVault(100 * ONE);

        vm.prank(DAO);
        adapter.pause();

        vm.prank(address(vault));
        vm.expectRevert();
        adapter.withdrawAll(0);
    }

    function test_UnpauseRestoresOperations() public {
        _depositViaVault(100 * ONE);

        vm.prank(DAO);
        adapter.pause();

        vm.prank(DAO);
        adapter.unpause();

        vm.prank(address(vault));
        uint256 withdrawn = adapter.withdrawAll(0);
        assertGt(withdrawn, 0, "operations restored after unpause");
    }

    // ─── Asset Getter ──────────────────────────────────────────────────────

    function test_AssetReturnsUnderlying() public view {
        assertEq(adapter.asset(), address(underlying));
    }

    // ─── Rescue Token ──────────────────────────────────────────────────────

    function test_RescueRevertsForProtectedTokens() public {
        vm.prank(DAO);
        vm.expectRevert(EnosysStrategyAdapter.ZeroAddress.selector);
        adapter.rescueToken(IERC20(underlying), DAO, 1);

        vm.prank(DAO);
        vm.expectRevert(EnosysStrategyAdapter.ZeroAddress.selector);
        adapter.rescueToken(IERC20(pairedToken), DAO, 1);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    function _depositViaVault(uint256 amount) private {
        underlying.mint(address(vault), amount);
        vm.startPrank(address(vault));
        underlying.approve(address(adapter), amount);
        adapter.deposit(amount);
        vm.stopPrank();
    }
}

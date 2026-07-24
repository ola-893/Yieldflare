// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {KineticStrategyAdapter} from "../src/adapters/KineticStrategyAdapter.sol";
import {ParentVault} from "../src/core/ParentVault.sol";
import {IParentVault} from "../src/interfaces/IParentVault.sol";
import {IKToken} from "../src/interfaces/IKToken.sol";
import {IKineticComptroller} from "../src/interfaces/IKineticComptroller.sol";

// ─── Test helpers (protocol stubs for the test harness) ────────────────────
// These are NOT backend mocks — they are standard Foundry test doubles that
// simulate the Compound-v2 kToken/Comptroller interface surface for unit tests.
// Fork tests against live Flare RPC validate the real integration.

contract TestUnderlying is ERC20 {
    constructor() ERC20("Test USDC.e", "USDC.e") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract TestRewardToken is ERC20 {
    constructor() ERC20("JOULE", "JOULE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Simulates a Compound-v2 kToken with a configurable exchange rate.
contract TestKToken is IKToken {
    ERC20 private _underlying;
    uint256 private _exchangeRate = 1e18; // 1:1 initially
    mapping(address => uint256) private _balances;
    uint256 private _totalMinted;

    constructor(address underlying_) {
        _underlying = ERC20(underlying_);
    }

    function setExchangeRate(uint256 rate) external {
        _exchangeRate = rate;
    }

    function mint(uint256 mintAmount) external returns (uint256) {
        IERC20(address(_underlying)).transferFrom(msg.sender, address(this), mintAmount);
        uint256 kTokens = (mintAmount * 1e18) / _exchangeRate;
        _balances[msg.sender] += kTokens;
        _totalMinted += kTokens;
        return 0; // success
    }

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256) {
        uint256 kTokensNeeded = (redeemAmount * 1e18) / _exchangeRate;
        if (_balances[msg.sender] < kTokensNeeded) return 1; // error
        _balances[msg.sender] -= kTokensNeeded;
        _totalMinted -= kTokensNeeded;
        IERC20(address(_underlying)).transfer(msg.sender, redeemAmount);
        return 0;
    }

    function redeem(uint256 redeemTokens) external returns (uint256) {
        if (_balances[msg.sender] < redeemTokens) return 1;
        uint256 underlyingAmount = (redeemTokens * _exchangeRate) / 1e18;
        _balances[msg.sender] -= redeemTokens;
        _totalMinted -= redeemTokens;
        IERC20(address(_underlying)).transfer(msg.sender, underlyingAmount);
        return 0;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }

    function balanceOfUnderlying(address owner) external view returns (uint256) {
        return (_balances[owner] * _exchangeRate) / 1e18;
    }

    function exchangeRateStored() external view returns (uint256) {
        return _exchangeRate;
    }

    function underlying() external view returns (address) {
        return address(_underlying);
    }
}

/// @dev Simulates Kinetic's Comptroller reward claiming.
contract TestComptroller is IKineticComptroller {
    TestRewardToken private _rewardToken;
    uint256 public rewardPerClaim = 10e18;

    constructor(TestRewardToken rewardToken_) {
        _rewardToken = rewardToken_;
    }

    function setRewardPerClaim(uint256 amount) external {
        rewardPerClaim = amount;
    }

    function claimReward(uint8, address holder, address[] calldata) external {
        _rewardToken.mint(holder, rewardPerClaim);
    }

    function claimReward(uint8, address holder) external {
        _rewardToken.mint(holder, rewardPerClaim);
    }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

contract KineticStrategyAdapterTest is Test {
    address private constant DAO = address(0xDA0);
    uint256 private constant ONE = 1e18;

    TestUnderlying private underlying;
    TestRewardToken private rewardToken;
    TestKToken private kToken;
    TestComptroller private comptroller;
    ParentVault private vault;
    KineticStrategyAdapter private adapter;

    function setUp() public {
        underlying = new TestUnderlying();
        rewardToken = new TestRewardToken();
        kToken = new TestKToken(address(underlying));
        comptroller = new TestComptroller(rewardToken);

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

        adapter = new KineticStrategyAdapter(
            IERC20(underlying),
            kToken,
            comptroller,
            address(vault),
            DAO,
            IERC20(rewardToken),
            0 // rewardType
        );

        vault.setStrategyAdapter(address(adapter), true);

        // Fund the kToken with underlying for redeem operations
        underlying.mint(address(kToken), 1_000_000 * ONE);
    }

    // ─── Access Control ────────────────────────────────────────────────────

    function test_OnlyVaultCanDeposit() public {
        underlying.mint(address(this), 100 * ONE);
        underlying.approve(address(adapter), 100 * ONE);

        vm.expectRevert(abi.encodeWithSelector(KineticStrategyAdapter.OnlyVault.selector, address(this)));
        adapter.deposit(100 * ONE);
    }

    function test_OnlyVaultCanWithdraw() public {
        vm.expectRevert(abi.encodeWithSelector(KineticStrategyAdapter.OnlyVault.selector, address(this)));
        adapter.withdraw(100 * ONE, 100 * ONE);
    }

    function test_OnlyVaultCanWithdrawAll() public {
        vm.expectRevert(abi.encodeWithSelector(KineticStrategyAdapter.OnlyVault.selector, address(this)));
        adapter.withdrawAll(0);
    }

    // ─── Deposit / TotalValue ──────────────────────────────────────────────

    function test_DepositRecordsCorrectTotalValue() public {
        _depositViaVaultRebalance(1000 * ONE);

        assertEq(adapter.totalValue(), 1000 * ONE, "totalValue should reflect deposited amount at 1:1 rate");
        assertGt(kToken.balanceOf(address(adapter)), 0, "adapter should hold kTokens");
    }

    function test_TotalValueReflectsAccruedInterest() public {
        _depositViaVaultRebalance(1000 * ONE);

        // Simulate interest accrual: exchange rate rises 5%
        kToken.setExchangeRate(1.05e18);

        assertEq(adapter.totalValue(), 1050 * ONE, "totalValue should reflect 5% interest");
    }

    // ─── WithdrawAll + Slippage ────────────────────────────────────────────

    function test_WithdrawAllReturnsFullBalance() public {
        _depositViaVaultRebalance(1000 * ONE);

        uint256 vaultBalanceBefore = underlying.balanceOf(address(vault));

        vm.prank(address(vault));
        uint256 assetsWithdrawn = adapter.withdrawAll(999 * ONE);

        assertEq(assetsWithdrawn, 1000 * ONE, "should withdraw full deposited amount");
        assertEq(adapter.totalValue(), 0, "totalValue should be 0 after full withdrawal");
        assertEq(
            underlying.balanceOf(address(vault)),
            vaultBalanceBefore + 1000 * ONE,
            "vault should receive all assets"
        );
    }

    function test_WithdrawAllRevertsOnSlippage() public {
        _depositViaVaultRebalance(1000 * ONE);

        vm.prank(address(vault));
        vm.expectRevert(
            abi.encodeWithSelector(KineticStrategyAdapter.SlippageExceeded.selector, 1001 * ONE, 1000 * ONE)
        );
        adapter.withdrawAll(1001 * ONE);
    }

    function test_WithdrawAllWithAccruedInterest() public {
        _depositViaVaultRebalance(1000 * ONE);
        kToken.setExchangeRate(1.10e18); // 10% interest

        vm.prank(address(vault));
        uint256 assetsWithdrawn = adapter.withdrawAll(1099 * ONE);

        assertEq(assetsWithdrawn, 1100 * ONE, "should withdraw principal + interest");
    }

    // ─── Partial Withdraw ──────────────────────────────────────────────────

    function test_PartialWithdraw() public {
        _depositViaVaultRebalance(1000 * ONE);

        vm.prank(address(vault));
        uint256 assetsWithdrawn = adapter.withdraw(500 * ONE, 500 * ONE);

        assertEq(assetsWithdrawn, 500 * ONE, "should withdraw exact requested amount");
        assertEq(adapter.totalValue(), 500 * ONE, "remaining value should be 500");
    }

    // ─── Reward Harvesting ─────────────────────────────────────────────────

    function test_HarvestSendsRewardsToRecipient() public {
        _depositViaVaultRebalance(100 * ONE);
        address treasury = address(0x1234);

        vm.prank(DAO);
        adapter.harvestRewards(treasury);

        assertEq(rewardToken.balanceOf(treasury), 10 * ONE, "treasury should receive JOULE rewards");
        assertEq(rewardToken.balanceOf(address(adapter)), 0, "adapter should hold no reward residual");
    }

    function test_HarvestRequiresOwner() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        adapter.harvestRewards(address(0x1234));
    }

    // ─── Pause ─────────────────────────────────────────────────────────────

    function test_PausePreventsDeposit() public {
        vm.prank(DAO);
        adapter.pause();

        vm.prank(address(vault));
        vm.expectRevert();
        adapter.deposit(100 * ONE);
    }

    // ─── Asset Getter ──────────────────────────────────────────────────────

    function test_AssetReturnsUnderlying() public view {
        assertEq(adapter.asset(), address(underlying));
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    /**
     * @dev Simulates a vault-authorized deposit by directly calling the adapter from the vault address.
     *      In production, the ParentVault calls adapter.deposit() during executeRebalance.
     */
    function _depositViaVaultRebalance(uint256 amount) private {
        underlying.mint(address(vault), amount);
        vm.startPrank(address(vault));
        underlying.approve(address(adapter), amount);
        adapter.deposit(amount);
        vm.stopPrank();
    }
}

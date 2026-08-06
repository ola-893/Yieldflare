// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {ParentVault} from "../src/core/ParentVault.sol";
import {IParentVault} from "../src/interfaces/IParentVault.sol";
import {IStrategyAdapter} from "../src/interfaces/IStrategyAdapter.sol";

contract MockFAsset is ERC20 {
    constructor() ERC20("Mock FAsset", "MFASSET") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}

contract MockStrategy is IStrategyAdapter {
    using SafeERC20 for IERC20;

    error NotVault(address caller);
    error MinimumAmountNotMet(uint256 minimum, uint256 actual);

    IERC20 private immutable _asset;
    address public immutable vault;
    uint16 public withdrawalBps = 10_000;

    constructor(IERC20 asset_, address vault_) {
        _asset = asset_;
        vault = vault_;
    }

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault(msg.sender);
        _;
    }

    function asset() external view returns (address) {
        return address(_asset);
    }

    function setWithdrawalBps(uint16 newWithdrawalBps) external {
        withdrawalBps = newWithdrawalBps;
    }

    function deposit(uint256 amount) external onlyVault returns (uint256 assetsDeposited) {
        _asset.safeTransferFrom(msg.sender, address(this), amount);
        return amount;
    }

    function withdraw(uint256 amount, uint256 minAmountOut) external onlyVault returns (uint256 assetsWithdrawn) {
        assetsWithdrawn = (amount * withdrawalBps) / 10_000;
        if (assetsWithdrawn < minAmountOut) revert MinimumAmountNotMet(minAmountOut, assetsWithdrawn);
        _asset.safeTransfer(vault, assetsWithdrawn);
    }

    function withdrawAll(uint256 minAmountOut) external onlyVault returns (uint256 assetsWithdrawn) {
        assetsWithdrawn = (_asset.balanceOf(address(this)) * withdrawalBps) / 10_000;
        if (assetsWithdrawn < minAmountOut) revert MinimumAmountNotMet(minAmountOut, assetsWithdrawn);
        _asset.safeTransfer(vault, assetsWithdrawn);
    }

    function totalValue() external view returns (uint256) {
        return _asset.balanceOf(address(this));
    }
}

contract ParentVaultTest is Test {
    uint256 private constant TEE_PRIVATE_KEY = 0xA11CE;
    address private constant ALICE = address(0xA11CE);
    address private constant KEEPER = address(0xBEEF);
    address private constant FASSET_ADAPTER = address(0xFAD);
    uint256 private constant ONE = 1e18;

    MockFAsset private asset;
    ParentVault private vault;
    MockStrategy private strategyA;
    MockStrategy private strategyB;
    address private teeSigner;

    function setUp() public {
        vm.warp(2 days);
        asset = new MockFAsset();
        teeSigner = vm.addr(TEE_PRIVATE_KEY);

        ParentVault implementation = new ParentVault();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(
                ParentVault.initialize,
                (IERC20(asset), "FlareYield", "FYD", address(this), teeSigner, FASSET_ADAPTER, uint16(1_000))
            )
        );
        vault = ParentVault(address(proxy));

        strategyA = new MockStrategy(IERC20(asset), address(vault));
        strategyB = new MockStrategy(IERC20(asset), address(vault));
        vault.setStrategyAdapter(address(strategyA), true);
        vault.setStrategyAdapter(address(strategyB), true);
    }

    function test_FCCSignatureVerification() public {
        IParentVault.RebalancePayload memory validPayload =
            _signedPayload(address(strategyA), 0, 0, block.timestamp + 1 hours);
        vm.prank(KEEPER);
        vault.executeRebalance(validPayload);
        assertEq(vault.rebalanceNonce(), 1);
        assertEq(vault.activeStrategy(), address(strategyA));

        IParentVault.RebalancePayload memory invalidSignerPayload =
            _payload(address(strategyB), 0, 1, block.timestamp + 1 hours);
        invalidSignerPayload.signature = _signature(invalidSignerPayload, 0xB0B);
        vm.expectRevert(abi.encodeWithSelector(ParentVault.InvalidTeeSignature.selector, vm.addr(0xB0B)));
        vault.executeRebalance(invalidSignerPayload);

        IParentVault.RebalancePayload memory wrongNoncePayload =
            _signedPayload(address(strategyB), 0, 7, block.timestamp + 1 hours);
        vm.expectRevert(abi.encodeWithSelector(ParentVault.InvalidNonce.selector, 1, 7));
        vault.executeRebalance(wrongNoncePayload);

        IParentVault.RebalancePayload memory expiredPayload =
            _signedPayload(address(strategyB), 0, 1, block.timestamp - 1);
        vm.expectRevert(
            abi.encodeWithSelector(ParentVault.RebalanceExpired.selector, block.timestamp - 1, block.timestamp)
        );
        vault.executeRebalance(expiredPayload);
    }

    function test_RebalanceSlippage() public {
        _deposit(ALICE, 100 * ONE);

        IParentVault.RebalancePayload memory intoStrategyA =
            _signedPayload(address(strategyA), 0, 0, block.timestamp + 1 hours);
        vault.executeRebalance(intoStrategyA);
        assertEq(asset.balanceOf(address(strategyA)), 90 * ONE, "10% should remain liquid");

        strategyA.setWithdrawalBps(9_000);
        IParentVault.RebalancePayload memory intoStrategyB =
            _signedPayload(address(strategyB), 90 * ONE, 1, block.timestamp + 1 hours);
        vm.expectRevert(abi.encodeWithSelector(MockStrategy.MinimumAmountNotMet.selector, 90 * ONE, 81 * ONE));
        vault.executeRebalance(intoStrategyB);

        assertEq(vault.activeStrategy(), address(strategyA), "failed rebalance must be atomic");
    }

    function test_FAssetFeeDilution() public {
        bytes32 depositId = keccak256("xrp-direct-mint-1");
        vm.prank(FASSET_ADAPTER);
        vault.queueFAssetDeposit(depositId, ALICE);

        asset.mint(FASSET_ADAPTER, 100 * ONE);
        vm.prank(FASSET_ADAPTER);
        asset.approve(address(vault), 95 * ONE);
        vm.prank(FASSET_ADAPTER);
        uint256 shares = vault.settleFAssetDeposit(depositId, 95 * ONE);

        assertEq(shares, 95 * ONE, "shares use the post-fee mint amount");
        assertEq(vault.balanceOf(ALICE), 95 * ONE);
        assertEq(asset.balanceOf(address(vault)), 95 * ONE);
        assertEq(asset.balanceOf(FASSET_ADAPTER), 5 * ONE, "uncredited executor fee remains outside the vault");
    }

    function test_ERC4626Compliance() public {
        _deposit(ALICE, 100 * ONE);

        assertEq(vault.asset(), address(asset));
        assertEq(vault.totalAssets(), 100 * ONE);
        assertEq(vault.previewDeposit(50 * ONE), 50 * ONE);
        assertEq(vault.convertToShares(50 * ONE), 50 * ONE);
        assertEq(vault.convertToAssets(50 * ONE), 50 * ONE);

        uint256 aliceBalanceBefore = asset.balanceOf(ALICE);
        vm.prank(ALICE);
        uint256 sharesBurned = vault.withdraw(25 * ONE, ALICE, ALICE);

        assertEq(sharesBurned, 25 * ONE);
        assertEq(asset.balanceOf(ALICE), aliceBalanceBefore + 25 * ONE);
        assertEq(vault.totalAssets(), 75 * ONE);
        assertEq(vault.totalSupply(), 75 * ONE);
    }

    function test_ERC4626WithdrawPullsStrategyShortfall() public {
        _deposit(ALICE, 100 * ONE);
        vault.executeRebalance(_signedPayload(address(strategyA), 0, 0, block.timestamp + 1 hours));

        vm.prank(ALICE);
        uint256 sharesBurned = vault.withdraw(50 * ONE, ALICE, ALICE);

        assertEq(sharesBurned, 50 * ONE);
        assertEq(asset.balanceOf(address(vault)), 0);
        assertEq(asset.balanceOf(address(strategyA)), 50 * ONE);
        assertEq(vault.totalAssets(), 50 * ONE);
        assertEq(vault.totalSupply(), 50 * ONE);
    }

    function test_RebalanceRejectsSpotYieldAttestation() public {
        IParentVault.RebalancePayload memory spotPayload = _payload(address(strategyA), 0, 0, block.timestamp + 1 hours);
        spotPayload.twapStart = block.timestamp - 1 hours;
        spotPayload.signature = _signature(spotPayload, TEE_PRIVATE_KEY);

        vm.expectRevert(
            abi.encodeWithSelector(ParentVault.InvalidTwapWindow.selector, spotPayload.twapStart, spotPayload.twapEnd)
        );
        vault.executeRebalance(spotPayload);
    }

    function test_TeeFallbackFullyReturnsFundsToVault() public {
        _deposit(ALICE, 100 * ONE);
        vault.executeRebalance(_signedPayload(address(strategyA), 0, 0, block.timestamp + 1 hours));

        vm.warp(block.timestamp + vault.TEE_TIMEOUT() + 1);
        uint256 withdrawn = vault.forceWithdrawAll(90 * ONE);

        assertEq(withdrawn, 90 * ONE);
        assertEq(vault.activeStrategy(), address(0));
        assertEq(vault.totalAssets(), 100 * ONE);
        assertEq(asset.balanceOf(address(strategyA)), 0);
    }

    function _deposit(address user, uint256 assets) private {
        asset.mint(user, assets);
        vm.startPrank(user);
        asset.approve(address(vault), assets);
        vault.deposit(assets, user);
        vm.stopPrank();
    }

    function _signedPayload(address newStrategy, uint256 minAmountOut, uint256 nonce, uint256 deadline)
        private
        view
        returns (IParentVault.RebalancePayload memory payload)
    {
        payload = _payload(newStrategy, minAmountOut, nonce, deadline);
        payload.signature = _signature(payload, TEE_PRIVATE_KEY);
    }

    function _payload(address newStrategy, uint256 minAmountOut, uint256 nonce, uint256 deadline)
        private
        view
        returns (IParentVault.RebalancePayload memory)
    {
        return IParentVault.RebalancePayload({
            newStrategy: newStrategy,
            minAmountOut: minAmountOut,
            nonce: nonce,
            deadline: deadline,
            twapStart: block.timestamp - 24 hours,
            twapEnd: block.timestamp,
            strategyDataHash: keccak256("medianized-24h-yield-snapshot"),
            signature: bytes("")
        });
    }

    function _signature(IParentVault.RebalancePayload memory payload, uint256 privateKey)
        private
        view
        returns (bytes memory)
    {
        bytes32 digest = vault.rebalanceDigest(payload);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}

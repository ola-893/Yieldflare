// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {FAssetAdapter} from "../src/adapters/FAssetAdapter.sol";
import {ParentVault} from "../src/core/ParentVault.sol";
import {IMintingTagManager} from "../src/interfaces/IMintingTagManager.sol";
import {IParentVault} from "../src/interfaces/IParentVault.sol";

contract BridgeMockFAsset is ERC20 {
    constructor() ERC20("Mock FXRP", "MFXRP") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}

contract MockMintingTagManager is IMintingTagManager {
    error IncorrectFee(uint256 expected, uint256 received);
    error NotTagOwner(address caller, uint256 tag);

    uint256 public override reservationFee;
    uint256 private _nextTag = 1;

    mapping(uint256 tag => address owner) private _owner;
    mapping(uint256 tag => address recipient) private _recipient;
    mapping(uint256 tag => address executor) private _executor;

    constructor(uint256 reservationFee_) {
        reservationFee = reservationFee_;
    }

    function reserve() external payable returns (uint256 tag) {
        if (msg.value != reservationFee) revert IncorrectFee(reservationFee, msg.value);
        tag = _nextTag++;
        _owner[tag] = msg.sender;
        _recipient[tag] = msg.sender;
    }

    function setMintingRecipient(uint256 tag, address recipient) external {
        _requireOwner(tag);
        _recipient[tag] = recipient;
    }

    function setAllowedExecutor(uint256 tag, address executor) external {
        _requireOwner(tag);
        _executor[tag] = executor;
    }

    function mintingRecipient(uint256 tag) external view returns (address) {
        return _recipient[tag];
    }

    function allowedExecutor(uint256 tag) external view returns (address) {
        return _executor[tag];
    }

    function _requireOwner(uint256 tag) private view {
        if (_owner[tag] != msg.sender) revert NotTagOwner(msg.sender, tag);
    }
}

    contract FAssetAdapterTest is Test {
        address private constant ALICE = address(0xA11CE);
        address private constant BOB = address(0xB0B);
        address private constant EXECUTOR = address(0xE11CE);
        uint256 private constant RESERVATION_FEE = 1 ether;
        uint256 private constant ONE = 1e18;

        BridgeMockFAsset private fAsset;
        MockMintingTagManager private tagManager;
        ParentVault private vault;
        FAssetAdapter private adapter;

        function setUp() public {
            fAsset = new BridgeMockFAsset();
            tagManager = new MockMintingTagManager(RESERVATION_FEE);

            ParentVault implementation = new ParentVault();
            ERC1967Proxy proxy = new ERC1967Proxy(
                address(implementation),
                abi.encodeCall(
                    ParentVault.initialize,
                    (IERC20(fAsset), "FlareYield", "FYD", address(this), address(0xFcc), address(0), uint16(1_000))
                )
            );
            vault = ParentVault(address(proxy));

            adapter = new FAssetAdapter(
                IERC20(fAsset), tagManager, IParentVault(address(vault)), address(this), EXECUTOR
            );
            vault.setFAssetAdapter(address(adapter));
            vm.deal(ALICE, 10 ether);
        }

        function test_MintingTagRoutesPostFeeAssetsToMappedUser() public {
            uint256 tag = _registerTag(ALICE);
            assertEq(adapter.tagUser(tag), ALICE);
            assertEq(adapter.tagExecutor(tag), EXECUTOR);
            assertEq(tagManager.mintingRecipient(tag), address(adapter));
            assertEq(tagManager.allowedExecutor(tag), EXECUTOR);

            bytes32 depositId = keccak256("xrpl-payment-1");
            fAsset.mint(address(adapter), 95 * ONE);
            fAsset.mint(EXECUTOR, 5 * ONE);

            vm.prank(EXECUTOR);
            adapter.processDirectMint(tag, depositId, 95 * ONE);

            assertEq(vault.pendingDepositReceiver(depositId), ALICE);
            assertEq(adapter.totalPendingFAssets(), 95 * ONE);
            assertEq(vault.balanceOf(ALICE), 0, "shares are pending until settlement");

            vm.prank(BOB);
            uint256 shares = adapter.settleDirectMint(depositId);

            assertEq(shares, 95 * ONE, "only the actual post-fee FAsset balance mints shares");
            assertEq(vault.balanceOf(ALICE), 95 * ONE);
            assertEq(fAsset.balanceOf(address(vault)), 95 * ONE);
            assertEq(fAsset.balanceOf(address(adapter)), 0);
            assertEq(adapter.totalPendingFAssets(), 0);
        }

        function test_ProcessRejectsGrossQuoteWhenBalanceShowsPostFeeAmount() public {
            uint256 tag = _registerTag(ALICE);
            fAsset.mint(address(adapter), 95 * ONE);

            vm.prank(EXECUTOR);
            vm.expectRevert(abi.encodeWithSelector(FAssetAdapter.UnexpectedMintBalance.selector, 100 * ONE, 95 * ONE));
            adapter.processDirectMint(tag, keccak256("xrpl-payment-2"), 100 * ONE);

            assertEq(vault.totalAssets(), 0);
            assertEq(vault.balanceOf(ALICE), 0);
        }

        function test_ProcessRequiresTagActiveExecutor() public {
            uint256 tag = _registerTag(ALICE);
            fAsset.mint(address(adapter), ONE);

            vm.prank(BOB);
            vm.expectRevert(abi.encodeWithSelector(FAssetAdapter.NotTagExecutor.selector, BOB, tag));
            adapter.processDirectMint(tag, keccak256("xrpl-payment-3"), ONE);
        }

        function test_ProcessRejectsZeroDepositId() public {
            uint256 tag = _registerTag(ALICE);
            fAsset.mint(address(adapter), ONE);

            vm.prank(EXECUTOR);
            vm.expectRevert(FAssetAdapter.ZeroDepositId.selector);
            adapter.processDirectMint(tag, bytes32(0), ONE);
        }

        function test_TagCannotAcceptSecondUnsettledMint() public {
            uint256 tag = _registerTag(ALICE);
            bytes32 firstDepositId = keccak256("xrpl-payment-4");
            fAsset.mint(address(adapter), 10 * ONE);
            vm.prank(EXECUTOR);
            adapter.processDirectMint(tag, firstDepositId, 10 * ONE);

            fAsset.mint(address(adapter), 20 * ONE);
            vm.prank(EXECUTOR);
            vm.expectRevert(abi.encodeWithSelector(FAssetAdapter.TagHasPendingMint.selector, tag, firstDepositId));
            adapter.processDirectMint(tag, keccak256("xrpl-payment-5"), 20 * ONE);
        }

        function _registerTag(address user) private returns (uint256) {
            vm.prank(user);
            return adapter.registerMintingTag{value: RESERVATION_FEE}();
        }
    }

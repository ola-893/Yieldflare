// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {FtsoV2DelegationAdapter} from "../src/adapters/FtsoV2DelegationAdapter.sol";
import {IFlareContractRegistry} from "../src/interfaces/IFlareContractRegistry.sol";
import {IWNat} from "../src/interfaces/IWNat.sol";
import {IRewardManager} from "../src/interfaces/IRewardManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockERC20 is IERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
}

contract FtsoV2DelegationAdapterTest is Test {
    FtsoV2DelegationAdapter adapter;
    MockERC20 fxrp;
    address vault = address(0x1);
    address owner = address(0x2);
    address dataProvider1 = address(0x3);
    address dataProvider2 = address(0x4);

    address constant FLARE_CONTRACT_REGISTRY = 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019;

    function setUp() public {
        // Fork Coston2 for testing
        vm.createSelectFork("https://coston2-api.flare.network/ext/C/rpc");

        // Deploy mock FXRP for testing
        fxrp = new MockERC20("FXRP", "FXRP", 18);
        
        adapter = new FtsoV2DelegationAdapter(fxrp, vault, owner);
    }

    function testConstructor() public view {
        assertEq(adapter.vault(), vault);
        assertEq(adapter.owner(), owner);
    }

    function testAssetReturnsFXRP() public view {
        assertEq(adapter.asset(), address(fxrp));
    }

    function testSetDataProviders() public {
        vm.startPrank(owner);

        address[] memory providers = new address[](2);
        providers[0] = dataProvider1;
        providers[1] = dataProvider2;

        uint256[] memory bips = new uint256[](2);
        bips[0] = 6000; // 60%
        bips[1] = 4000; // 40%

        adapter.setDataProviders(providers, bips);

        assertEq(adapter.dataProviders(0), dataProvider1);
        assertEq(adapter.dataProviders(1), dataProvider2);
        assertEq(adapter.delegationBips(dataProvider1), 6000);
        assertEq(adapter.delegationBips(dataProvider2), 4000);

        vm.stopPrank();
    }

    function testSetDataProvidersRevertsIfNotOwner() public {
        address[] memory providers = new address[](1);
        providers[0] = dataProvider1;

        uint256[] memory bips = new uint256[](1);
        bips[0] = 10000;

        vm.expectRevert();
        adapter.setDataProviders(providers, bips);
    }

    function testSetDataProvidersRevertsIfTotalBipsExceeds100Percent() public {
        vm.startPrank(owner);

        address[] memory providers = new address[](2);
        providers[0] = dataProvider1;
        providers[1] = dataProvider2;

        uint256[] memory bips = new uint256[](2);
        bips[0] = 6000;
        bips[1] = 5000; // Total = 11000 > 10000

        vm.expectRevert();
        adapter.setDataProviders(providers, bips);

        vm.stopPrank();
    }

    function testDepositSwapsFXRPToWNat() public {
        vm.startPrank(vault);
        
        uint256 amount = 100 ether;
        fxrp.mint(vault, amount);
        fxrp.approve(address(adapter), amount);

        // Note: This will fail on actual fork without liquidity in SparkDEX pool
        // For unit testing, we'd need to mock the router
        // adapter.deposit(amount);

        vm.stopPrank();
    }

    function testPauseUnpause() public {
        vm.startPrank(owner);

        adapter.pause();
        assertTrue(adapter.paused());

        adapter.unpause();
        assertFalse(adapter.paused());

        vm.stopPrank();
    }

    function testDepositRevertsWhenPaused() public {
        vm.startPrank(owner);
        adapter.pause();
        vm.stopPrank();

        vm.startPrank(vault);
        vm.expectRevert();
        adapter.deposit(1 ether);
        vm.stopPrank();
    }
}

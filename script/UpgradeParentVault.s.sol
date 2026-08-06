// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ParentVault} from "../src/core/ParentVault.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

contract UpgradeParentVault is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Existing vault proxies on Coston2
        address fxrpVaultProxy = 0x01f64160E4928Eba5607aE294F9B66090Dc323B3;
        address cdpVaultProxy = 0x71cF7B0f792400a2533e917bcfB3892b34b569e8;
        
        console.log("===============================================");
        console.log("Upgrading ParentVault with FCE Integration");
        console.log("===============================================");
        console.log("Deployer:", deployer);
        console.log("FXRP Vault Proxy:", fxrpVaultProxy);
        console.log("CDP Vault Proxy:", cdpVaultProxy);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new implementation
        console.log("Deploying new ParentVault implementation...");
        ParentVault newImplementation = new ParentVault();
        console.log("New implementation:", address(newImplementation));
        console.log("");

        // Upgrade FXRP vault
        console.log("Upgrading FXRP vault...");
        UUPSUpgradeable(fxrpVaultProxy).upgradeToAndCall(
            address(newImplementation),
            "" // No initialization needed for upgrade
        );
        console.log("[OK] FXRP vault upgraded");
        console.log("");

        // Upgrade CDP vault
        console.log("Upgrading CDP vault...");
        UUPSUpgradeable(cdpVaultProxy).upgradeToAndCall(
            address(newImplementation),
            "" // No initialization needed for upgrade
        );
        console.log("[OK] CDP vault upgraded");

        vm.stopBroadcast();

        console.log("");
        console.log("===============================================");
        console.log("Upgrade Complete!");
        console.log("===============================================");
        console.log("");
        console.log("New Implementation:", address(newImplementation));
        console.log("");
        console.log("Next steps to configure FCE:");
        console.log("1. Set rebalance threshold (e.g., 10 FXRP = 10000000)");
        console.log("2. Set instruction sender address (TeeExtensionRegistry)");
        console.log("3. Fund vault and call deposit() to trigger automatic rebalance");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ParentVault} from "../src/core/ParentVault.sol";
import {MockInstructionSender} from "../src/mock/MockInstructionSender.sol";

contract ConfigureFCE is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Existing vault proxies on Coston2
        address fxrpVaultProxy = 0x01f64160E4928Eba5607aE294F9B66090Dc323B3;
        
        console.log("===============================================");
        console.log("Configuring FCE for ParentVault");
        console.log("===============================================");
        console.log("Deployer:", deployer);
        console.log("FXRP Vault:", fxrpVaultProxy);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy mock instruction sender
        console.log("Deploying MockInstructionSender...");
        MockInstructionSender instructionSender = new MockInstructionSender();
        console.log("MockInstructionSender:", address(instructionSender));
        console.log("");

        // Configure FXRP vault
        ParentVault vault = ParentVault(fxrpVaultProxy);
        
        console.log("Setting instruction sender...");
        vault.setInstructionSender(address(instructionSender));
        
        console.log("Setting rebalance threshold to 5 FXRP (5000000)...");
        vault.setRebalanceThreshold(5000000); // 5 FXRP (6 decimals)

        vm.stopBroadcast();

        console.log("");
        console.log("===============================================");
        console.log("Configuration Complete!");
        console.log("===============================================");
        console.log("");
        console.log("MockInstructionSender:", address(instructionSender));
        console.log("Rebalance Threshold: 5 FXRP");
        console.log("");
        console.log("Test the integration:");
        console.log("1. Deposit FXRP into vault (will auto-trigger rebalance if >= 5 FXRP):");
        console.log("   cast send", fxrpVaultProxy, "deposit(uint256,address) 10000000", deployer);
        console.log("");
        console.log("2. Or manually trigger rebalance:");
        console.log("   cast send", fxrpVaultProxy, "requestRebalance()");
    }
}

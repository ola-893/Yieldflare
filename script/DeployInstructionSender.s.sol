// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {InstructionSender} from "../src/fce/InstructionSender.sol";

/**
 * @title DeployInstructionSender
 * @notice Deploys production InstructionSender for FCE integration
 * @dev Uses addresses from config/coston2/deployed-addresses.json
 */
contract DeployInstructionSender is Script {
    // Coston2 FlareTeeManager address (diamond proxy for both interfaces)
    // From: config/coston2/deployed-addresses.json in fce-extension-scaffold
    address constant FLARE_TEE_MANAGER = 0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying InstructionSender...");
        console.log("Deployer:", deployer);
        console.log("Registry:", FLARE_TEE_MANAGER);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        InstructionSender instructionSender = new InstructionSender(
            FLARE_TEE_MANAGER,  // ITeeExtensionRegistry
            FLARE_TEE_MANAGER   // ITeeMachineRegistry (same diamond proxy)
        );

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("InstructionSender:", address(instructionSender));
        console.log("\nNext steps:");
        console.log("1. Register extension with this InstructionSender address");
        console.log("2. Call instructionSender.setExtensionId()");
        console.log("3. Update ParentVault: vault.setInstructionSender(address)");
        
        // Save to file
        string memory json = string.concat(
            '{\n',
            '  "instructionSender": "', vm.toString(address(instructionSender)), '",\n',
            '  "registry": "', vm.toString(FLARE_TEE_MANAGER), '",\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "timestamp": ', vm.toString(block.timestamp), '\n',
            '}'
        );

        string memory filename = string.concat(
            "deployments/instruction-sender-",
            vm.toString(block.chainid),
            "-",
            vm.toString(block.timestamp),
            ".json"
        );

        vm.writeFile(filename, json);
        vm.writeFile("deployments/instruction-sender-latest.json", json);

        console.log("\nDeployment info saved to:", filename);
    }
}

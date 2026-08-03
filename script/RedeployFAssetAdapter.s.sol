// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ParentVault} from "../src/core/ParentVault.sol";
import {FAssetAdapter} from "../src/adapters/FAssetAdapter.sol";
import {IMintingTagManager} from "../src/interfaces/IMintingTagManager.sol";
import {IParentVault} from "../src/interfaces/IParentVault.sol";

/**
 * @title RedeployFAssetAdapter
 * @notice Redeploys FAssetAdapter with IERC721Receiver fix and updates ParentVault
 * @dev Run with:
 *      forge script script/RedeployFAssetAdapter.s.sol --rpc-url $COSTON2_RPC_URL --account deployer --broadcast -vvv
 */
contract RedeployFAssetAdapter is Script {
    function run() external {
        // Load existing deployment addresses
        address parentVaultProxy = vm.envAddress("PARENT_VAULT_PROXY");
        address fxrp = vm.envAddress("FXRP_ADDRESS");
        address mintingTagManager = vm.envAddress("MINTING_TAG_MANAGER");
        address daoMultisig = vm.envAddress("DAO_MULTISIG");
        address defaultDirectMintExecutor = vm.envAddress("DEFAULT_DIRECT_MINT_EXECUTOR");

        console2.log("========================================");
        console2.log("FAssetAdapter Redeployment");
        console2.log("========================================");
        console2.log("Network: Coston2");
        console2.log("Deployer:", vm.envAddress("DEPLOYER_ADDRESS"));
        console2.log("");
        console2.log("Existing Contracts:");
        console2.log("  ParentVault (Proxy):", parentVaultProxy);
        console2.log("  FXRP:", fxrp);
        console2.log("  MintingTagManager:", mintingTagManager);
        console2.log("");

        vm.startBroadcast();

        // Deploy new FAssetAdapter with IERC721Receiver support
        console2.log("Deploying new FAssetAdapter with IERC721Receiver fix...");
        address newFAssetAdapter = address(
            new FAssetAdapter(
                IERC20(fxrp),
                IMintingTagManager(mintingTagManager),
                IParentVault(parentVaultProxy),
                daoMultisig,
                defaultDirectMintExecutor
            )
        );
        console2.log("  New FAssetAdapter:", newFAssetAdapter);
        console2.log("");

        // Update ParentVault to use new adapter
        console2.log("Updating ParentVault to use new FAssetAdapter...");
        ParentVault vault = ParentVault(parentVaultProxy);
        vault.setFAssetAdapter(newFAssetAdapter);
        console2.log("  Updated!");
        console2.log("");

        vm.stopBroadcast();

        // Print summary
        console2.log("========================================");
        console2.log("Redeployment Complete!");
        console2.log("========================================");
        console2.log("");
        console2.log("New FAssetAdapter:", newFAssetAdapter);
        console2.log("");
        console2.log("The new adapter includes IERC721Receiver support.");
        console2.log("You can now call registerMintingTag() successfully.");
        console2.log("");
        console2.log("Next Steps:");
        console2.log("1. Update frontend metadata with new FAssetAdapter address");
        console2.log("2. Call FAssetAdapter.registerMintingTag() with 100 C2FLR");
        console2.log("3. Test the direct minting flow");
        console2.log("");

        // Save deployment artifact
        saveDeploymentArtifact(parentVaultProxy, newFAssetAdapter, fxrp, mintingTagManager, daoMultisig, defaultDirectMintExecutor);
    }

    function saveDeploymentArtifact(
        address parentVault,
        address fAssetAdapter,
        address fxrp,
        address mintingTagManager,
        address daoMultisig,
        address defaultExecutor
    ) private {
        string memory json = "deployment";
        
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeString(json, "network", "Coston2");
        vm.serializeAddress(json, "parentVault", parentVault);
        vm.serializeAddress(json, "fAssetAdapter", fAssetAdapter);
        vm.serializeAddress(json, "fxrp", fxrp);
        vm.serializeAddress(json, "mintingTagManager", mintingTagManager);
        vm.serializeAddress(json, "daoMultisig", daoMultisig);
        string memory output = vm.serializeAddress(json, "defaultExecutor", defaultExecutor);
        
        string memory filename = string.concat("./deployments/coston2-", vm.toString(block.timestamp), ".json");
        
        vm.writeJson(output, filename);
        vm.writeJson(output, "./deployments/coston2-latest.json");
        
        console2.log("Deployment artifacts saved to:", filename);
    }
}

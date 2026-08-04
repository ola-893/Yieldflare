// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {FtsoV2DelegationAdapter} from "../src/adapters/FtsoV2DelegationAdapter.sol";
import {SparkDexAdapter} from "../src/adapters/SparkDexAdapter.sol";
import {SmartAccountDirectMintAdapter} from "../src/adapters/SmartAccountDirectMintAdapter.sol";
import {EnosysStrategyAdapter} from "../src/adapters/EnosysStrategyAdapter.sol";
import {IParentVault} from "../src/interfaces/IParentVault.sol";
import {IAssetManager} from "../src/interfaces/IAssetManager.sol";
import {IMintingTagManager} from "../src/interfaces/IMintingTagManager.sol";
import {IFlareContractRegistry} from "../src/interfaces/IFlareContractRegistry.sol";
import {IEnosysRouter} from "../src/interfaces/IEnosysRouter.sol";
import {IEnosysV3Pool} from "../src/interfaces/IEnosysV3Pool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {NetworkConfig} from "./NetworkConfig.sol";

/**
 * @title DeployYieldStrategies
 * @notice Deploys four working yield strategies for Coston2 testnet:
 *         1. FTSO v2 Delegation Adapter - Earns delegation rewards
 *         2. SparkDEX Adapter - Earns LP swap fees
 *         3. Smart Account Direct Mint Adapter - 1-click atomic deposits
 *         4. Enosys V3 LP Adapter - Concentrated liquidity on Enosys DEX
 */
contract DeployYieldStrategies is Script {
    // ─── Configuration from .env ───────────────────────────────────────────────
    address parentVault = vm.envAddress("PARENT_VAULT_ADDRESS");
    address fxrp = vm.envAddress("FXRP_ADDRESS");
    address assetManagerFXRP = vm.envOr("ASSET_MANAGER_FXRP_ADDRESS", address(0));
    address mintingTagManager = vm.envOr("MINTING_TAG_MANAGER_ADDRESS", address(0));
    address daoMultisig = vm.envAddress("DAO_MULTISIG");
    address defaultExecutor = vm.envAddress("DEFAULT_EXECUTOR");

    address constant FLARE_CONTRACT_REGISTRY = 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Get network configuration
        NetworkConfig.Config memory cfg = NetworkConfig.get();

        // Fallback to FlareContractRegistry resolution if addresses not set in .env
        if (assetManagerFXRP == address(0) || assetManagerFXRP.code.length == 0) {
            assetManagerFXRP = IFlareContractRegistry(FLARE_CONTRACT_REGISTRY).getContractAddressByName("AssetManagerFXRP");
            if (assetManagerFXRP == address(0)) {
                assetManagerFXRP = 0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA;
            }
        }

        if (mintingTagManager == address(0) || mintingTagManager.code.length == 0) {
            mintingTagManager = IFlareContractRegistry(FLARE_CONTRACT_REGISTRY).getContractAddressByName("MintingTagManager");
            if (mintingTagManager == address(0)) {
                mintingTagManager = 0x094511737909b626391106bBc21B25feb2D67B96;
            }
        }

        console.log("=================================================");
        console.log("Deploying Yield Strategies to", cfg.name);
        console.log("=================================================");
        console.log("Deployer:", deployer);
        console.log("ParentVault:", parentVault);
        console.log("FXRP:", fxrp);
        console.log("Enosys Available:", cfg.hasEnosysDeployment);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ─── 1. Deploy FTSO v2 Delegation Adapter ──────────────────────────────
        console.log("Deploying FtsoV2DelegationAdapter...");
        FtsoV2DelegationAdapter ftsoAdapter = new FtsoV2DelegationAdapter(
            IERC20(fxrp),
            parentVault,
            daoMultisig // initialOwner
        );
        console.log("  -> FtsoV2DelegationAdapter:", address(ftsoAdapter));

        // ─── 2. Deploy SparkDEX Adapter ────────────────────────────────────────
        console.log("\nDeploying SparkDexAdapter...");
        SparkDexAdapter sparkDexAdapter = new SparkDexAdapter(
            IERC20(fxrp),
            parentVault,
            daoMultisig // initialOwner
        );
        console.log("  -> SparkDexAdapter:", address(sparkDexAdapter));

        // ─── 3. Deploy Smart Account Direct Mint Adapter ───────────────────────
        console.log("\nDeploying SmartAccountDirectMintAdapter...");
        SmartAccountDirectMintAdapter smartAccountAdapter = new SmartAccountDirectMintAdapter(
            IParentVault(parentVault),
            IAssetManager(assetManagerFXRP),
            IMintingTagManager(mintingTagManager),
            defaultExecutor,
            daoMultisig // initialOwner
        );
        console.log("  -> SmartAccountDirectMintAdapter:", address(smartAccountAdapter));

        // ─── 4. Deploy Enosys V3 LP Adapter (if available) ─────────────────────
        address enosysAdapterAddress = address(0);
        if (cfg.hasEnosysDeployment) {
            console.log("\nDeploying EnosysStrategyAdapter...");
            EnosysStrategyAdapter enosysAdapter = new EnosysStrategyAdapter(
                IERC20(fxrp),
                IERC20(cfg.wflr),
                IEnosysRouter(cfg.enosysRouter),
                IEnosysV3Pool(cfg.enosysPoolFXRPWFLR),
                parentVault,
                daoMultisig,
                3000 // 0.30% pool fee tier
            );
            enosysAdapterAddress = address(enosysAdapter);
            console.log("  -> EnosysStrategyAdapter:", enosysAdapterAddress);
        } else {
            console.log("\nSkipping EnosysStrategyAdapter (not available on", cfg.name, ")");
        }

        vm.stopBroadcast();

        // ─── Save deployment info ──────────────────────────────────────────────
        string memory enosysEntry = cfg.hasEnosysDeployment
            ? string(abi.encodePacked('    "enosys": "', vm.toString(enosysAdapterAddress), '",\n'))
            : "";

        string memory deploymentJson = string(abi.encodePacked(
            '{\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "network": "', cfg.name, '",\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "strategies": {\n',
            '    "ftsoV2Delegation": "', vm.toString(address(ftsoAdapter)), '",\n',
            '    "sparkDex": "', vm.toString(address(sparkDexAdapter)), '",\n',
            '    "smartAccountDirectMint": "', vm.toString(address(smartAccountAdapter)), '",\n',
            enosysEntry,
            '    "enosysAvailable": ', cfg.hasEnosysDeployment ? "true" : "false", '\n',
            '  },\n',
            '  "references": {\n',
            '    "parentVault": "', vm.toString(parentVault), '",\n',
            '    "fxrp": "', vm.toString(fxrp), '",\n',
            '    "assetManagerFXRP": "', vm.toString(assetManagerFXRP), '",\n',
            '    "mintingTagManager": "', vm.toString(mintingTagManager), '"'
        ));

        if (cfg.hasEnosysDeployment) {
            deploymentJson = string(abi.encodePacked(
                deploymentJson,
                ',\n',
                '    "enosysRouter": "', vm.toString(cfg.enosysRouter), '",\n',
                '    "enosysPool": "', vm.toString(cfg.enosysPoolFXRPWFLR), '",\n',
                '    "wflr": "', vm.toString(cfg.wflr), '"\n'
            ));
        } else {
            deploymentJson = string(abi.encodePacked(deploymentJson, '\n'));
        }

        deploymentJson = string(abi.encodePacked(
            deploymentJson,
            '  }\n',
            '}'
        ));

        string memory filename = string(abi.encodePacked(
            "deployments/yield-strategies-",
            vm.toString(block.timestamp),
            ".json"
        ));
        vm.writeFile(filename, deploymentJson);
        
        // Also update the latest symlink
        vm.writeFile("deployments/yield-strategies-latest.json", deploymentJson);

        console.log("\n=================================================");
        console.log("Deployment Complete!");
        console.log("=================================================");
        console.log("\nStrategy Adapters Deployed:");
        console.log("  1. FTSO v2 Delegation:", address(ftsoAdapter));
        console.log("  2. SparkDEX LP:", address(sparkDexAdapter));
        console.log("  3. Smart Account Atomic:", address(smartAccountAdapter));
        if (cfg.hasEnosysDeployment) {
            console.log("  4. Enosys V3 LP:", enosysAdapterAddress);
        }
        console.log("\nNext Steps:");
        console.log("  1. Approve strategies on ParentVault:");
        console.log("     cast send", parentVault, "\\");
        console.log("       'setStrategyAdapter(address,bool)' \\");
        console.log("       ", address(ftsoAdapter), "true \\");
        console.log("       --private-key $PRIVATE_KEY --rpc-url $COSTON2_RPC_URL");
        if (cfg.hasEnosysDeployment) {
            console.log("\n     cast send", parentVault, "\\");
            console.log("       'setStrategyAdapter(address,bool)' \\");
            console.log("       ", enosysAdapterAddress, "true \\");
            console.log("       --private-key $PRIVATE_KEY --rpc-url $COSTON2_RPC_URL");
        }
        console.log("\n  2. Configure FTSO data providers:");
        console.log("     cast send", address(ftsoAdapter), "\\");
        console.log("       'setDataProviders(address[],uint256[])' \\");
        console.log("       '[0x...provider1,0x...provider2]' '[5000,5000]' \\");
        console.log("       --private-key $PRIVATE_KEY --rpc-url $COSTON2_RPC_URL");
        console.log("\n  3. Test atomic deposits:");
        console.log("     - Register tag via SmartAccountDirectMintAdapter");
        console.log("     - Send XRP with 0xFE memo from XRPL wallet");
        console.log("     - Receive vault shares automatically!");
        console.log("\nDeployment saved to:", filename);
    }
}

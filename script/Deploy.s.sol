// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {ParentVault} from "../src/core/ParentVault.sol";
import {FAssetAdapter} from "../src/adapters/FAssetAdapter.sol";
import {KineticStrategyAdapter} from "../src/adapters/KineticStrategyAdapter.sol";
import {EnosysStrategyAdapter} from "../src/adapters/EnosysStrategyAdapter.sol";
import {IParentVault} from "../src/interfaces/IParentVault.sol";
import {IMintingTagManager} from "../src/interfaces/IMintingTagManager.sol";
import {IKToken} from "../src/interfaces/IKToken.sol";
import {IKineticComptroller} from "../src/interfaces/IKineticComptroller.sol";
import {IEnosysRouter} from "../src/interfaces/IEnosysRouter.sol";
import {IEnosysV3Pool} from "../src/interfaces/IEnosysV3Pool.sol";
import {NetworkConfig} from "./NetworkConfig.sol";

/**
 * @title IFlareContractRegistry
 * @notice Interface for Flare's ContractRegistry
 */
interface IFlareContractRegistry {
    function getContractAddressByName(string calldata _name) external view returns (address);
}

/**
 * @title Deploy
 * @notice Universal deployment script for FlareYield protocol.
 * @dev Branches based on block.chainid:
 *      - Coston2 (114): Deploys ParentVault + FAssetAdapter only (no Kinetic/Enosys)
 *      - Flare (14): Deploys full protocol (ParentVault + all 3 adapters)
 *
 *      Run with:
 *      Coston2: forge script script/Deploy.s.sol --rpc-url $COSTON2_RPC_URL --account deployer --broadcast --verify -vvv
 *      Mainnet: forge script script/Deploy.s.sol --rpc-url $FLARE_RPC_URL --account deployer --broadcast --verify -vvv
 *
 *      NO MOCKS. Coston2 uses real FAsset contracts. Kinetic/Enosys tested via mainnet fork.
 */
contract Deploy is Script {
    // Deployment artifacts
    address public parentVaultImplementation;
    address public parentVaultProxy;
    address public fAssetAdapter;
    address public kineticAdapter;
    address public enosysAdapter;

    // Environment variables
    address public daoMultisig;
    address public fccSignerAddress;
    address public defaultDirectMintExecutor;
    uint16 public performanceFeeBps;

    function run() external {
        // Load configuration
        loadEnvironmentConfig();
        NetworkConfig.Config memory config = NetworkConfig.get();

        console2.log("========================================");
        console2.log("FlareYield Deployment");
        console2.log("========================================");
        console2.log("Network:", config.name);
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", vm.envAddress("DEPLOYER_ADDRESS"));
        console2.log("");

        vm.startBroadcast();

        // ─── Step 1: Resolve FAsset Contracts ───────────────────────────────────
        console2.log("Step 1: Resolving FAsset contracts from Flare ContractRegistry...");
        
        IFlareContractRegistry registry = IFlareContractRegistry(config.flareContractRegistry);
        address assetManagerFXRP = registry.getContractAddressByName("AssetManagerFXRP");
        console2.log("  AssetManagerFXRP:", assetManagerFXRP);

        address fxrp = getFAssetAddress(assetManagerFXRP);
        console2.log("  FXRP token:", fxrp);

        address mintingTagManager = getMintingTagManager(assetManagerFXRP);
        console2.log("  MintingTagManager:", mintingTagManager);
        console2.log("");

        // ─── Step 2: Deploy ParentVault ─────────────────────────────────────────
        console2.log("Step 2: Deploying ParentVault...");
        
        parentVaultImplementation = address(new ParentVault());
        console2.log("  Implementation:", parentVaultImplementation);

        bytes memory initData = abi.encodeCall(
            ParentVault.initialize,
            (
                IERC20(fxrp),
                "FlareYield FXRP Vault",
                "fyFXRP",
                daoMultisig,
                fccSignerAddress,
                address(0), // No TEE verification contract yet
                performanceFeeBps
            )
        );

        parentVaultProxy = address(new ERC1967Proxy(parentVaultImplementation, initData));
        console2.log("  Proxy:", parentVaultProxy);
        console2.log("");

        // ─── Step 3: Deploy FAssetAdapter ───────────────────────────────────────
        console2.log("Step 3: Deploying FAssetAdapter...");
        
        fAssetAdapter = address(
            new FAssetAdapter(
                IERC20(fxrp),
                IMintingTagManager(mintingTagManager),
                IParentVault(parentVaultProxy),
                daoMultisig,
                defaultDirectMintExecutor
            )
        );
        console2.log("  FAssetAdapter:", fAssetAdapter);
        console2.log("");

        // ─── Step 4: Configure Vault with FAssetAdapter ─────────────────────────
        console2.log("Step 4: Configuring ParentVault...");
        
        ParentVault vault = ParentVault(parentVaultProxy);
        vault.setFAssetAdapter(fAssetAdapter);
        console2.log("  Set FAssetAdapter");
        console2.log("");

        // ─── Conditional: Deploy Strategy Adapters (Mainnet Only) ───────────────
        if (block.chainid == 14) {
            // FLARE MAINNET: Deploy Kinetic and Enosys adapters
            console2.log("Step 5: Deploying Strategy Adapters (Mainnet only)...");
            
            require(config.hasKineticDeployment, "Kinetic not available on this network");
            require(config.hasEnosysDeployment, "Enosys not available on this network");

            // Deploy KineticStrategyAdapter
            kineticAdapter = address(
                new KineticStrategyAdapter(
                    IERC20(fxrp),
                    IKToken(config.kineticKFXRP),
                    IKineticComptroller(config.kineticComptroller),
                    parentVaultProxy,
                    daoMultisig,
                    IERC20(getJouleTokenAddress()), // JOULE reward token
                    0 // rewardType = 0 for JOULE
                )
            );
            console2.log("  KineticStrategyAdapter:", kineticAdapter);

            // Deploy EnosysStrategyAdapter
            enosysAdapter = address(
                new EnosysStrategyAdapter(
                    IERC20(fxrp),
                    IERC20(config.wflr),
                    IEnosysRouter(config.enosysRouter),
                    IEnosysV3Pool(config.enosysPoolFXRPWFLR),
                    parentVaultProxy,
                    daoMultisig,
                    3000 // 0.3% pool fee
                )
            );
            console2.log("  EnosysStrategyAdapter:", enosysAdapter);
            console2.log("");

            // Whitelist strategy adapters
            console2.log("Step 6: Whitelisting Strategy Adapters...");
            vault.setStrategyAdapter(kineticAdapter, true);
            console2.log("  Whitelisted KineticStrategyAdapter");
            vault.setStrategyAdapter(enosysAdapter, true);
            console2.log("  Whitelisted EnosysStrategyAdapter");
            console2.log("");
        } else if (block.chainid == 114) {
            // COSTON2: Skip strategy adapters (not deployed on testnet)
            console2.log("Step 5: Skipping Strategy Adapters (Coston2 - use mainnet fork for testing)");
            console2.log("  Kinetic and Enosys have no Coston2 deployment.");
            console2.log("  Test these adapters via: forge test --fork-url $FLARE_RPC_URL");
            console2.log("");
        }

        vm.stopBroadcast();

        // ─── Deployment Summary ──────────────────────────────────────────────────
        printDeploymentSummary(config, fxrp, assetManagerFXRP, mintingTagManager);

        // Save deployment artifacts
        saveDeploymentArtifacts(config, fxrp, assetManagerFXRP, mintingTagManager);
    }

    function loadEnvironmentConfig() private {
        daoMultisig = vm.envAddress("DAO_MULTISIG");
        fccSignerAddress = vm.envAddress("FCC_SIGNER_ADDRESS");
        defaultDirectMintExecutor = vm.envAddress("DEFAULT_DIRECT_MINT_EXECUTOR");
        performanceFeeBps = uint16(vm.envUint("PERFORMANCE_FEE_BPS"));

        require(daoMultisig != address(0), "DAO_MULTISIG not set");
        require(fccSignerAddress != address(0), "FCC_SIGNER_ADDRESS not set");
        require(defaultDirectMintExecutor != address(0), "DEFAULT_DIRECT_MINT_EXECUTOR not set");
        require(performanceFeeBps <= 10000, "Invalid performance fee");
    }

    function getFAssetAddress(address assetManager) private view returns (address) {
        (bool success, bytes memory data) = assetManager.staticcall(abi.encodeWithSignature("fAsset()"));
        require(success, "Failed to get fAsset address");
        return abi.decode(data, (address));
    }

    function getMintingTagManager(address assetManager) private view returns (address) {
        (bool success, bytes memory data) = assetManager.staticcall(
            abi.encodeWithSignature("getMintingTagManager()")
        );
        require(success, "Failed to get MintingTagManager address");
        return abi.decode(data, (address));
    }

    function getJouleTokenAddress() private view returns (address) {
        // TODO: Look up actual JOULE token address on Flare mainnet
        // For now, return a placeholder that will cause deployment to fail if not updated
        return vm.envOr("JOULE_TOKEN_ADDRESS", address(0));
    }

    function printDeploymentSummary(
        NetworkConfig.Config memory config,
        address fxrp,
        address assetManager,
        address tagManager
    ) private view {
        console2.log("========================================");
        console2.log("Deployment Complete!");
        console2.log("========================================");
        console2.log("");
        console2.log("Core Contracts:");
        console2.log("  ParentVault (Proxy):", parentVaultProxy);
        console2.log("  FAssetAdapter:", fAssetAdapter);
        
        if (block.chainid == 14) {
            console2.log("  KineticStrategyAdapter:", kineticAdapter);
            console2.log("  EnosysStrategyAdapter:", enosysAdapter);
        }
        
        console2.log("");
        console2.log("FAsset Infrastructure:");
        console2.log("  FXRP:", fxrp);
        console2.log("  AssetManagerFXRP:", assetManager);
        console2.log("  MintingTagManager:", tagManager);
        console2.log("");
        console2.log("Configuration:");
        console2.log("  DAO Multisig:", daoMultisig);
        console2.log("  FCC Signer:", fccSignerAddress);
        console2.log("  Default Executor:", defaultDirectMintExecutor);
        console2.log("  Performance Fee:", performanceFeeBps, "bps");
        console2.log("");
        
        if (block.chainid == 114) {
            console2.log("IMPORTANT: This is a Coston2 deployment.");
            console2.log("Kinetic and Enosys adapters are NOT deployed (mainnet-only protocols).");
            console2.log("The vault will hold idle assets on Coston2, which is fine for testing.");
            console2.log("Test Kinetic/Enosys via: forge test --fork-url $FLARE_RPC_URL");
            console2.log("");
        }
        
        console2.log("Next Steps:");
        console2.log("1. Transfer ownership to multisig:");
        console2.log("   cast send", parentVaultProxy, '"transferOwnership(address)"', daoMultisig);
        
        if (block.chainid == 114) {
            console2.log("2. Get testnet FXRP: https://faucet.flare.network/coston2");
            console2.log("3. Register minting tag via FAssetAdapter.registerMintingTag()");
            console2.log("4. Test real XRPL to Flare direct minting flow");
        } else {
            console2.log("2. Verify all contracts on Flare Explorer");
            console2.log("3. Set TVL cap before accepting user deposits");
            console2.log("4. Test rebalancing with small amounts first");
        }
        console2.log("");
    }

    function saveDeploymentArtifacts(
        NetworkConfig.Config memory config,
        address fxrp,
        address assetManager,
        address tagManager
    ) private {
        string memory json = "deployment";
        
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeString(json, "network", config.name);
        vm.serializeAddress(json, "parentVault", parentVaultProxy);
        vm.serializeAddress(json, "parentVaultImplementation", parentVaultImplementation);
        vm.serializeAddress(json, "fAssetAdapter", fAssetAdapter);
        
        if (block.chainid == 14) {
            vm.serializeAddress(json, "kineticAdapter", kineticAdapter);
            vm.serializeAddress(json, "enosysAdapter", enosysAdapter);
        }
        
        vm.serializeAddress(json, "fxrp", fxrp);
        vm.serializeAddress(json, "assetManagerFXRP", assetManager);
        vm.serializeAddress(json, "mintingTagManager", tagManager);
        vm.serializeAddress(json, "daoMultisig", daoMultisig);
        vm.serializeAddress(json, "fccSigner", fccSignerAddress);
        string memory output = vm.serializeAddress(json, "defaultExecutor", defaultDirectMintExecutor);
        
        string memory networkName = block.chainid == 114 ? "coston2" : "flare";
        string memory filename = string.concat("./deployments/", networkName, "-", vm.toString(block.timestamp), ".json");
        
        vm.writeJson(output, filename);
        vm.writeJson(output, string.concat("./deployments/", networkName, "-latest.json"));
        
        console2.log("Deployment artifacts saved to:", filename);
    }
}

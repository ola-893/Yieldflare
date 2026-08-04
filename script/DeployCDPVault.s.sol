// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {ParentVault} from "../src/core/ParentVault.sol";
import {EnosysStrategyAdapter} from "../src/adapters/EnosysStrategyAdapter.sol";
import {IEnosysRouter} from "../src/interfaces/IEnosysRouter.sol";
import {IEnosysV3Pool} from "../src/interfaces/IEnosysV3Pool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployCDPVault
 * @notice Deploys ParentVault for CDP token and EnosysStrategyAdapter for CDP/WC2FLR liquidity
 * @dev This creates the second vault in the multi-asset FlareYield platform
 */
contract DeployCDPVault is Script {
    // ─── Verified Coston2 Contract Addresses ───────────────────────────────────
    address constant CDP_TOKEN = 0x41D503D78D319D685fb9311363732009f7224059;
    address constant WC2FLR_TOKEN = 0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273;
    address constant ENOSYS_ROUTER = 0xD2fD55647A90fD1f2D071e115Bb713B3C145D5e2;
    address constant ENOSYS_FACTORY = 0x537279D95Dd98Ea5a5a4C24B523Df9959967A657;
    address constant ENOSYS_CDP_WC2FLR_POOL = 0x81e7628F5add2286E798B6b77B4C5ace4C62A40E;
    uint24 constant POOL_FEE = 3000; // 0.30%

    // ─── Configuration from .env ───────────────────────────────────────────────
    address daoMultisig = vm.envAddress("DAO_MULTISIG");
    address fccSigner = vm.envAddress("FCC_SIGNER_ADDRESS");

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=================================================");
        console.log("Deploying CDP Vault & Strategy to Coston2");
        console.log("=================================================");
        console.log("Deployer:", deployer);
        console.log("CDP Token:", CDP_TOKEN);
        console.log("WC2FLR Token:", WC2FLR_TOKEN);
        console.log("Enosys Pool:", ENOSYS_CDP_WC2FLR_POOL);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ─── 1. Deploy ParentVault Implementation ──────────────────────────────
        console.log("Deploying ParentVault implementation...");
        address cdpVaultImplementation = address(new ParentVault());
        console.log("  -> Implementation:", cdpVaultImplementation);

        // ─── 2. Deploy ParentVault Proxy for CDP ──────────────────────────────
        console.log("\nDeploying ParentVault proxy for CDP...");
        bytes memory initData = abi.encodeCall(
            ParentVault.initialize,
            (
                IERC20(CDP_TOKEN),
                "Flare Yield Vault CDP",
                "fyCDP",
                daoMultisig,
                fccSigner,
                address(0), // No TEE verification contract yet
                1000 // 10% performance fee
            )
        );

        address cdpVaultProxy = address(new ERC1967Proxy(cdpVaultImplementation, initData));
        console.log("  -> ParentVault_CDP (Proxy):", cdpVaultProxy);

        // ─── 3. Deploy EnosysStrategyAdapter for CDP ───────────────────────────
        console.log("\nDeploying EnosysStrategyAdapter for CDP...");
        EnosysStrategyAdapter cdpEnosysAdapter = new EnosysStrategyAdapter(
            IERC20(CDP_TOKEN),
            IERC20(WC2FLR_TOKEN),
            IEnosysRouter(ENOSYS_ROUTER),
            IEnosysV3Pool(ENOSYS_CDP_WC2FLR_POOL),
            cdpVaultProxy,
            daoMultisig,
            POOL_FEE
        );
        console.log("  -> EnosysStrategyAdapter_CDP:", address(cdpEnosysAdapter));

        vm.stopBroadcast();

        // ─── Save deployment info ──────────────────────────────────────────────
        string memory deploymentJson = string(abi.encodePacked(
            '{\n',
            '  "chainId": 114,\n',
            '  "network": "Coston2",\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "vaults": {\n',
            '    "cdpVault": "', vm.toString(cdpVaultProxy), '",\n',
            '    "cdpVaultImplementation": "', vm.toString(cdpVaultImplementation), '"\n',
            '  },\n',
            '  "strategies": {\n',
            '    "enosysCdpAdapter": "', vm.toString(address(cdpEnosysAdapter)), '"\n',
            '  },\n',
            '  "references": {\n',
            '    "cdpToken": "', vm.toString(CDP_TOKEN), '",\n',
            '    "wc2flrToken": "', vm.toString(WC2FLR_TOKEN), '",\n',
            '    "enosysRouter": "', vm.toString(ENOSYS_ROUTER), '",\n',
            '    "enosysPool": "', vm.toString(ENOSYS_CDP_WC2FLR_POOL), '",\n',
            '    "poolFee": ', vm.toString(POOL_FEE), '\n',
            '  }\n',
            '}'
        ));

        string memory filename = string(abi.encodePacked(
            "deployments/cdp-vault-",
            vm.toString(block.timestamp),
            ".json"
        ));
        vm.writeFile(filename, deploymentJson);
        
        // Also update the latest symlink
        vm.writeFile("deployments/cdp-vault-latest.json", deploymentJson);

        console.log("\n=================================================");
        console.log("Deployment Complete!");
        console.log("=================================================");
        console.log("\nDeployed Contracts:");
        console.log("  1. ParentVault_CDP (Proxy):", cdpVaultProxy);
        console.log("  2. ParentVault_CDP (Implementation):", cdpVaultImplementation);
        console.log("  3. EnosysStrategyAdapter_CDP:", address(cdpEnosysAdapter));
        console.log("\nAsset Configuration:");
        console.log("  - Underlying: CDP (0x41D503...4059)");
        console.log("  - Paired: WC2FLR (0xC67D...9273)");
        console.log("  - Pool: CDP/WC2FLR (0x81e7...40E)");
        console.log("  - Fee Tier: 0.30%");
        console.log("\nNext Steps:");
        console.log("  1. Approve strategy on ParentVault_CDP:");
        console.log("     cast send", cdpVaultProxy, "\\");
        console.log("       'setStrategyAdapter(address,bool)' \\");
        console.log("       ", address(cdpEnosysAdapter), "true \\");
        console.log("       --private-key $PRIVATE_KEY --rpc-url $COSTON2_RPC_URL --legacy");
        console.log("\n  2. Verify asset configuration:");
        console.log("     cast call", cdpVaultProxy, '"asset()(address)" --rpc-url $COSTON2_RPC_URL');
        console.log("\n  3. Test deposit (get CDP from Enosys Loans first):");
        console.log("     - Mint CDP on Enosys Loans using FXRP collateral");
        console.log("     - Approve CDP spending for vault");
        console.log("     - Deposit CDP into vault");
        console.log("     - Watch yield accumulate from Enosys V3 trading fees!");
        console.log("\nDeployment saved to:", filename);
    }
}

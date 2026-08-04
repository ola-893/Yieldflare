// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {IParentVault} from "../src/interfaces/IParentVault.sol";
import {IStrategyAdapter} from "../src/interfaces/IStrategyAdapter.sol";

/**
 * @title ExecuteInitialRebalance
 * @notice Script to execute the initial rebalance on ParentVault_FXRP to deploy capital into FtsoV2DelegationAdapter
 * @dev This script:
 *      1. Creates a properly signed EIP-712 RebalancePayload
 *      2. Executes the rebalance transaction
 *      3. Verifies the deployment was successful
 */
contract ExecuteInitialRebalance is Script {
    // EIP-712 type hashes (must match ParentVault.sol)
    bytes32 private constant REBALANCE_TYPEHASH = keccak256(
        "RebalancePayload(address newStrategy,uint256 minAmountOut,uint256 nonce,uint256 deadline,uint256 twapStart,uint256 twapEnd,bytes32 strategyDataHash)"
    );
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256("FlareYield ParentVault");
    bytes32 private constant VERSION_HASH = keccak256("1");

    // Contract addresses
    address private constant PARENT_VAULT_FXRP = 0x01f64160E4928Eba5607aE294F9B66090Dc323B3;
    address private constant FTSO_ADAPTER = 0xa0811A54F72Fd3e7b0F30d75227741feFE2755fB;
    address private constant FXRP = 0x0b6A3645c240605887a5532109323A3E12273dc7;

    IParentVault private vault;
    IStrategyAdapter private strategy;

    function run() external {
        vault = IParentVault(PARENT_VAULT_FXRP);
        strategy = IStrategyAdapter(FTSO_ADAPTER);

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("================================================================================");
        console2.log("Executing Initial Rebalance - ParentVault_FXRP");
        console2.log("================================================================================");
        console2.log("Network:         Coston2 (Chain ID: 114)");
        console2.log("Vault:           ", PARENT_VAULT_FXRP);
        console2.log("Target Strategy: ", FTSO_ADAPTER);
        console2.log("Deployer/Signer: ", deployer);
        console2.log("");

        // Get current nonce using low-level call since it's a public state variable
        (bool nonceSuccess, bytes memory nonceData) = PARENT_VAULT_FXRP.staticcall(
            abi.encodeWithSignature("rebalanceNonce()")
        );
        require(nonceSuccess, "Failed to get rebalanceNonce");
        uint256 currentNonce = abi.decode(nonceData, (uint256));

        (bool strategySuccess, bytes memory strategyData) = PARENT_VAULT_FXRP.staticcall(
            abi.encodeWithSignature("activeStrategy()")
        );
        require(strategySuccess, "Failed to get activeStrategy");
        address currentStrategy = abi.decode(strategyData, (address));

        uint256 vaultBalance = IERC20(FXRP).balanceOf(PARENT_VAULT_FXRP);
        
        (bool totalAssetsSuccess, bytes memory totalAssetsData) = PARENT_VAULT_FXRP.staticcall(
            abi.encodeWithSignature("totalAssets()")
        );
        require(totalAssetsSuccess, "Failed to get totalAssets");
        uint256 totalAssets = abi.decode(totalAssetsData, (uint256));

        console2.log("Pre-Rebalance State:");
        console2.log("  Current Nonce:         ", currentNonce);
        console2.log("  Active Strategy:       ", currentStrategy);
        console2.log("  Vault FXRP Balance:    ", vaultBalance / 1e18, "FXRP");
        console2.log("  Total Assets:          ", totalAssets / 1e18, "FXRP");
        console2.log("");

        // Create the rebalance payload
        IParentVault.RebalancePayload memory payload = _createPayload(currentNonce);
        
        // Sign the payload
        bytes32 digest = _computeDigest(payload);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(deployerPrivateKey, digest);
        payload.signature = abi.encodePacked(r, s, v);

        console2.log("Rebalance Payload:");
        console2.log("  New Strategy:      ", payload.newStrategy);
        console2.log("  Min Amount Out:    ", payload.minAmountOut);
        console2.log("  Nonce:             ", payload.nonce);
        console2.log("  Deadline:          ", payload.deadline);
        console2.log("  TWAP Start:        ", payload.twapStart);
        console2.log("  TWAP End:          ", payload.twapEnd);
        console2.log("  Strategy Data Hash:", vm.toString(payload.strategyDataHash));
        console2.log("  Signature Length:  ", payload.signature.length, "bytes");
        console2.log("");

        // Execute the rebalance
        console2.log("Executing rebalance transaction...");
        vm.startBroadcast(deployerPrivateKey);
        
        vault.executeRebalance(payload);
        
        vm.stopBroadcast();
        console2.log("Transaction submitted!");
        console2.log("");

        // Verify post-rebalance state
        (bool newNonceSuccess, bytes memory newNonceData) = PARENT_VAULT_FXRP.staticcall(
            abi.encodeWithSignature("rebalanceNonce()")
        );
        require(newNonceSuccess, "Failed to get new rebalanceNonce");
        uint256 newNonce = abi.decode(newNonceData, (uint256));

        (bool newStrategySuccess, bytes memory newStrategyData) = PARENT_VAULT_FXRP.staticcall(
            abi.encodeWithSignature("activeStrategy()")
        );
        require(newStrategySuccess, "Failed to get new activeStrategy");
        address newActiveStrategy = abi.decode(newStrategyData, (address));

        uint256 newVaultBalance = IERC20(FXRP).balanceOf(PARENT_VAULT_FXRP);
        uint256 strategyValue = strategy.totalValue();

        console2.log("Post-Rebalance State:");
        console2.log("  New Nonce:             ", newNonce);
        console2.log("  Active Strategy:       ", newActiveStrategy);
        console2.log("  Vault FXRP Balance:    ", newVaultBalance / 1e18, "FXRP");
        console2.log("  Strategy Total Value:  ", strategyValue / 1e18, "FXRP");
        console2.log("");

        // Verification checks
        bool success = true;
        console2.log("Verification:");
        
        if (newActiveStrategy == FTSO_ADAPTER) {
            console2.log("  [OK] Active strategy set to FtsoV2DelegationAdapter");
        } else {
            console2.log("  [FAIL] Active strategy not set correctly");
            success = false;
        }

        if (newNonce == currentNonce + 1) {
            console2.log("  [OK] Nonce incremented");
        } else {
            console2.log("  [FAIL] Nonce not incremented correctly");
            success = false;
        }

        if (strategyValue > 0) {
            console2.log("  [OK] Capital deployed to strategy");
        } else {
            console2.log("  [WARN] No capital deployed (vault may be empty)");
        }

        console2.log("");
        if (success) {
            console2.log("SUCCESS: Initial rebalance completed!");
        } else {
            console2.log("WARNING: Rebalance may have issues");
        }
        console2.log("================================================================================");
    }

    /**
     * @notice Creates a RebalancePayload for the initial deployment
     */
    function _createPayload(uint256 nonce) private view returns (IParentVault.RebalancePayload memory) {
        uint256 deadline = block.timestamp + 1 hours;
        uint256 twapEnd = block.timestamp;
        uint256 twapStart = twapEnd - 24 hours;

        return IParentVault.RebalancePayload({
            newStrategy: FTSO_ADAPTER,
            minAmountOut: 0, // No previous strategy, so no withdrawal
            nonce: nonce,
            deadline: deadline,
            twapStart: twapStart,
            twapEnd: twapEnd,
            strategyDataHash: keccak256(abi.encodePacked("initial-deployment-ftso-v2")),
            signature: bytes("") // Will be filled after signing
        });
    }

    /**
     * @notice Computes the EIP-712 digest for the payload
     */
    function _computeDigest(IParentVault.RebalancePayload memory payload) private view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                NAME_HASH,
                VERSION_HASH,
                block.chainid,
                PARENT_VAULT_FXRP
            )
        );

        bytes32 structHash = keccak256(
            abi.encode(
                REBALANCE_TYPEHASH,
                payload.newStrategy,
                payload.minAmountOut,
                payload.nonce,
                payload.deadline,
                payload.twapStart,
                payload.twapEnd,
                payload.strategyDataHash
            )
        );

        return MessageHashUtils.toTypedDataHash(domainSeparator, structHash);
    }
}

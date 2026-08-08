// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ParentVaultRecovery} from "../src/core/ParentVaultRecovery.sol";
import {ParentVault} from "../src/core/ParentVault.sol";
import {FAssetAdapter} from "../src/adapters/FAssetAdapter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title FixAdapterMismatch
 * @notice Phase 2 recovery: Fix vault's fAssetAdapter pointer and re-queue stuck deposits
 *
 * Problem:
 * - After Phase 1 recovery, vault's fAssetAdapter points to OLD adapter (0xB4b3...66)
 * - Current adapter (0x02D4...a7) processed deposits but vault rejected queueFAssetDeposit()
 * - Result: deposits stuck in adapter's pendingDirectMints but not in vault's pendingDepositReceiver
 *
 * Solution:
 * 1. Deploy a recovery adapter that can re-queue deposits
 * 2. Temporarily set the vault's fAssetAdapter to the recovery adapter
 * 3. Re-queue the stuck deposit
 * 4. Set vault's fAssetAdapter back to the current adapter
 */
contract FixAdapterMismatch is Script {
    address constant PARENT_VAULT_PROXY = 0x01f64160E4928Eba5607aE294F9B66090Dc323B3;
    address constant CURRENT_ADAPTER = 0x02D4F85301A2d1b3Bcc40BfD7937e6Fb2F5224a7;
    address constant OLD_ADAPTER = 0xB4b31E86F020Cf7F1B81B35C2E2Bd2CF6DA1BE66;

    // The stuck deposit
    bytes32 constant STUCK_DEPOSIT_ID = 0x79675cd62c6cc032d623bd5198d6bd0fe9018f2eaef74beca171f37e5d0dc6ae;
    address constant DEPOSIT_RECEIVER = 0xB0692534fAF7369e534AFffa5cC55EF52e6b6114;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy a recovery adapter that can re-queue deposits
        console.log("\n=== Step 1: Deploying Recovery Adapter ===");
        RecoveryAdapter recoveryAdapter = new RecoveryAdapter(PARENT_VAULT_PROXY);
        console.log("Recovery Adapter:", address(recoveryAdapter));

        // Step 2: Set vault's fAssetAdapter to recovery adapter
        console.log("\n=== Step 2: Setting vault's fAssetAdapter to Recovery Adapter ===");
        ParentVault vaultProxy = ParentVault(payable(PARENT_VAULT_PROXY));
        vaultProxy.setFAssetAdapter(address(recoveryAdapter));
        console.log("Vault fAssetAdapter updated to Recovery Adapter");

        // Step 3: Re-queue the stuck deposit
        console.log("\n=== Step 3: Re-queuing Stuck Deposit ===");
        console.log("Deposit ID:", STUCK_DEPOSIT_ID);
        console.log("Receiver:", DEPOSIT_RECEIVER);
        recoveryAdapter.reQueueDeposit(STUCK_DEPOSIT_ID, DEPOSIT_RECEIVER);
        console.log("Deposit re-queued successfully!");

        // Step 4: Verify the deposit is now in the vault
        console.log("\n=== Step 4: Verifying Vault State ===");
        address receiver = vaultProxy.pendingDepositReceiver(STUCK_DEPOSIT_ID);
        console.log("Vault pendingDepositReceiver:", receiver);
        require(receiver == DEPOSIT_RECEIVER, "Re-queue failed");

        // Step 5: Set vault's fAssetAdapter back to current adapter
        console.log("\n=== Step 5: Restoring vault's fAssetAdapter ===");
        vaultProxy.setFAssetAdapter(CURRENT_ADAPTER);
        console.log("Vault fAssetAdapter restored to:", CURRENT_ADAPTER);

        // Step 6: Verify the fix
        console.log("\n=== Step 6: Final Verification ===");
        address finalAdapter = vaultProxy.fAssetAdapter();
        console.log("Vault fAssetAdapter:", finalAdapter);
        require(finalAdapter == CURRENT_ADAPTER, "Adapter restoration failed");

        address finalReceiver = vaultProxy.pendingDepositReceiver(STUCK_DEPOSIT_ID);
        console.log("Vault pendingDepositReceiver:", finalReceiver);
        require(finalReceiver == DEPOSIT_RECEIVER, "Deposit not in vault");

        uint256 totalAssets = vaultProxy.totalAssets();
        console.log("Vault totalAssets:", totalAssets);

        vm.stopBroadcast();

        console.log("\n=== Fix Complete ===");
        console.log("The stuck deposit is now in the vault's pendingDepositReceiver.");
        console.log("User can now call settleDirectMint() to receive Flux shares.");
    }
}

/**
 * @title RecoveryAdapter
 * @notice Minimal adapter used temporarily to re-queue stuck deposits
 */
contract RecoveryAdapter {
    address public immutable vault;

    constructor(address vault_) {
        vault = vault_;
    }

    /**
     * @notice Re-queue a stuck deposit into the vault
     * @dev Can only be called by the vault owner (via the fix script)
     */
    function reQueueDeposit(bytes32 depositId, address receiver) external {
        ParentVault(vault).queueFAssetDeposit(depositId, receiver);
    }
}

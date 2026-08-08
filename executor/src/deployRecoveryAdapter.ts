import { createWalletClient, http, createPublicClient, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import solc from 'solc';

const PRIVATE_KEY = '0xce44c9cf317f66b5e3ea12ee1c92bb77a6dd2d02265b086eba66f8f338d5d7dc';
const VAULT = '0x01f64160E4928Eba5607aE294F9B66090Dc323B3' as `0x${string}`;
const CURRENT_ADAPTER = '0x02D4F85301A2d1b3Bcc40BfD7937e6Fb2F5224a7' as `0x${string}`;
const STUCK_DEPOSIT_ID = '0x79675cd62c6cc032d623bd5198d6bd0fe9018f2eaef74beca171f37e5d0dc6ae' as `0x${string}`;
const DEPOSIT_RECEIVER = '0xB0692534fAF7369e534AFffa5cC55EF52e6b6114' as `0x${string}`;
const RPC_URL = 'https://coston2-api.flare.network/ext/C/rpc';

const account = privateKeyToAccount(PRIVATE_KEY);
console.log('Sender:', account.address);

const chain = {
  id: 114,
  name: 'Coston2' as const,
  nativeCurrency: { name: 'C2FLR', symbol: 'C2FLR', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

const walletClient = createWalletClient({ account, chain, transport: http(RPC_URL) });
const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });

// Solidity source for RecoveryAdapter
const source = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IParentVault {
    function queueFAssetDeposit(bytes32 depositId, address receiver) external;
}

contract RecoveryAdapter {
    IParentVault public immutable vault;
    
    constructor(address _vault) {
        vault = IParentVault(_vault);
    }
    
    function reQueueDeposit(bytes32 depositId, address receiver) external {
        vault.queueFAssetDeposit(depositId, receiver);
    }
}
`;

// Compile with solc-js
function compile(): string {
  const input = {
    language: 'Solidity',
    sources: {
      'RecoveryAdapter.sol': { content: source }
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  
  if (output.errors) {
    for (const err of output.errors) {
      console.log('Compiler:', err.formattedMessage || err.message);
    }
  }

  const contract = output.contracts['RecoveryAdapter.sol']['RecoveryAdapter'];
  if (!contract) {
    throw new Error('Compilation failed - no contract output');
  }
  
  console.log('ABI:', JSON.stringify(contract.abi));
  console.log('Bytecode:', contract.evm.bytecode.object);
  
  return '0x' + contract.evm.bytecode.object;
}

async function main() {
  console.log('\n=== Compiling RecoveryAdapter ===');
  const bytecode = compile();
  console.log('Bytecode length:', (bytecode.length - 2) / 2, 'bytes');
  
  // Check current state
  console.log('\n=== Current State ===');
  const currentAdapter = await publicClient.readContract({
    address: VAULT,
    abi: parseAbi(['function fAssetAdapter() view returns (address)']),
    functionName: 'fAssetAdapter',
  });
  console.log('Vault fAssetAdapter:', currentAdapter);
  
  const currentReceiver = await publicClient.readContract({
    address: VAULT,
    abi: parseAbi(['function pendingDepositReceiver(bytes32) view returns (address)']),
    functionName: 'pendingDepositReceiver',
    args: [STUCK_DEPOSIT_ID],
  });
  console.log('pendingDepositReceiver:', currentReceiver);
  
  // Step 1: Deploy RecoveryAdapter
  console.log('\n=== Step 1: Deploying RecoveryAdapter ===');
  const deployHash = await walletClient.deployContract({
    abi: parseAbi([
      'constructor(address _vault)',
      'function vault() view returns (address)',
      'function reQueueDeposit(bytes32 depositId, address receiver) external'
    ]),
    args: [VAULT],
    bytecode: bytecode as `0x${string}`,
  });
  console.log('Deploy tx:', deployHash);
  
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  console.log('Deploy status:', deployReceipt.status === 'success' ? '✅ Success' : '❌ Failed');
  console.log('Contract address:', deployReceipt.contractAddress);
  
  if (!deployReceipt.contractAddress) {
    console.error('Deployment failed!');
    return;
  }
  
  const recoveryAdapter = deployReceipt.contractAddress;
  
  // Verify the adapter's vault is correct
  const adapterVault = await publicClient.readContract({
    address: recoveryAdapter,
    abi: parseAbi(['function vault() view returns (address)']),
    functionName: 'vault',
  });
  console.log('Recovery adapter vault:', adapterVault);
  console.log('Expected vault:', VAULT);
  
  if (adapterVault.toLowerCase() !== VAULT.toLowerCase()) {
    console.error('❌ Vault address mismatch in recovery adapter!');
    return;
  }
  
  // Step 2: Set vault's fAssetAdapter to recovery adapter
  console.log('\n=== Step 2: Setting vault fAssetAdapter to Recovery Adapter ===');
  const setAdapterHash = await walletClient.writeContract({
    address: VAULT,
    abi: parseAbi(['function setFAssetAdapter(address newAdapter) external']),
    functionName: 'setFAssetAdapter',
    args: [recoveryAdapter],
  });
  console.log('Set adapter tx:', setAdapterHash);
  const setAdapterReceipt = await publicClient.waitForTransactionReceipt({ hash: setAdapterHash });
  console.log('Set adapter status:', setAdapterReceipt.status === 'success' ? '✅ Success' : '❌ Failed');
  
  // Step 3: Call reQueueDeposit on the recovery adapter
  console.log('\n=== Step 3: Re-queuing Stuck Deposit ===');
  const reQueueHash = await walletClient.writeContract({
    address: recoveryAdapter,
    abi: parseAbi(['function reQueueDeposit(bytes32 depositId, address receiver) external']),
    functionName: 'reQueueDeposit',
    args: [STUCK_DEPOSIT_ID, DEPOSIT_RECEIVER],
  });
  console.log('Re-queue tx:', reQueueHash);
  const reQueueReceipt = await publicClient.waitForTransactionReceipt({ hash: reQueueHash });
  console.log('Re-queue status:', reQueueReceipt.status === 'success' ? '✅ Success' : '❌ Failed');
  
  // Check logs for FAssetDepositQueued event
  const fAssetDepositQueuedTopic = '0xe1696e3be62809120de5837343b32a720b0c909596c89e7c51f4be5b21b0e9b1'; // FAssetDepositQueued
  for (const log of reQueueReceipt.logs) {
    if (log.topics[0] === fAssetDepositQueuedTopic) {
      console.log('✅ FAssetDepositQueued event found!');
      console.log('  Deposit ID:', log.topics[1]);
      console.log('  Receiver:', log.topics[2]);
    }
  }
  
  // Step 4: Restore vault's fAssetAdapter to current adapter
  console.log('\n=== Step 4: Restoring vault fAssetAdapter ===');
  const restoreHash = await walletClient.writeContract({
    address: VAULT,
    abi: parseAbi(['function setFAssetAdapter(address newAdapter) external']),
    functionName: 'setFAssetAdapter',
    args: [CURRENT_ADAPTER],
  });
  console.log('Restore tx:', restoreHash);
  const restoreReceipt = await publicClient.waitForTransactionReceipt({ hash: restoreHash });
  console.log('Restore status:', restoreReceipt.status === 'success' ? '✅ Success' : '❌ Failed');
  
  // Step 5: Verify
  console.log('\n=== Step 5: Verification ===');
  const finalAdapter = await publicClient.readContract({
    address: VAULT,
    abi: parseAbi(['function fAssetAdapter() view returns (address)']),
    functionName: 'fAssetAdapter',
  });
  console.log('Final vault fAssetAdapter:', finalAdapter);
  
  const finalReceiver = await publicClient.readContract({
    address: VAULT,
    abi: parseAbi(['function pendingDepositReceiver(bytes32) view returns (address)']),
    functionName: 'pendingDepositReceiver',
    args: [STUCK_DEPOSIT_ID],
  });
  console.log('Final pendingDepositReceiver:', finalReceiver);
  
  if (finalAdapter.toLowerCase() === CURRENT_ADAPTER.toLowerCase() && 
      finalReceiver.toLowerCase() === DEPOSIT_RECEIVER.toLowerCase()) {
    console.log('\n🎉 FIX COMPLETE! The stuck deposit is now in the vault.');
    console.log('The user can now call settleDirectMint() to receive Flux shares.');
  } else {
    console.log('\n❌ Fix may have failed. Check the above values.');
  }
}

main().catch(console.error);

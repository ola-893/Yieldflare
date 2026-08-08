import { createWalletClient, http, createPublicClient, parseAbi, keccak256, toBytes, pad, encodePacked, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

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

// Compute selector for queueFAssetDeposit(bytes32,address)
const queueSelector = keccak256(toBytes('queueFAssetDeposit(bytes32,address)')).slice(0, 10);
console.log('queueFAssetDeposit selector:', queueSelector);

// Build raw EVM bytecode for a minimal contract that:
// 1. Stores vault address in slot 0 (constructor)
// 2. Has a fallback/receive that calls vault.queueFAssetDeposit(depositId, receiver)
//    with hardcoded depositId and receiver

// Constructor bytecode:
// Stores vault address in slot 0, then returns the runtime code
function buildBytecode(): `0x${string}` {
  // We'll build a contract that responds to ANY call by calling
  // vault.queueFAssetDeposit(hardcoded depositId, hardcoded receiver)
  
  // Runtime code:
  // 1. Load vault from slot 0
  // 2. Build calldata: selector(4) + depositId(32) + receiver(32) = 68 bytes
  // 3. CALL(vault, calldata)
  // 4. Return success
  
  // For simplicity, let's build the calldata in memory:
  // memory[0x00:0x04] = selector (left-aligned in 32 bytes, so actually at 0x00-0x1f with padding)
  // Actually, let's use a simpler memory layout:
  // memory[0x00:0x20] = selector (4 bytes) + depositId (28 bytes) -- first 32 bytes of ABI encoding
  // Wait, ABI encoding puts selector at bytes 0-3, then depositId at bytes 4-35, receiver at bytes 36-67
  
  // Let me use this memory layout for the CALL:
  // argsOffset = 0x00, argsSize = 0x44 (68 bytes)
  // memory[0x00:0x04] = selector
  // memory[0x04:0x24] = depositId  
  // memory[0x24:0x44] = receiver (padded to 32 bytes)
  
  // But MSTORE writes 32 bytes, so I need to be careful.
  
  // Let me use a different approach:
  // Store the full 68-byte calldata starting at memory[0x00]
  // Then CALL with argsOffset=0, argsSize=0x44
  
  // To store 68 bytes, I need 3 MSTORE operations:
  // MSTORE(0x00, selector << 224 | depositId >> 32)  -- but this is complex
  // Actually, let me just store each piece:
  
  // Step 1: Clear memory[0x00:0x44]
  // Step 2: Store selector at memory[0x00] (left-aligned in 32 bytes)
  // Step 3: Store depositId at memory[0x04] (this will have 4 bytes overlap with selector area)
  // Step 4: Store receiver at memory[0x24]
  
  // Hmm, MSTORE writes 32 bytes starting at the given offset.
  // MSTORE(0x00, X) writes X to memory[0x00:0x20]
  // MSTORE(0x04, Y) writes Y to memory[0x04:0x24] (overwrites memory[0x04:0x20])
  
  // So the approach is:
  // 1. MSTORE(0x00, depositId) -- stores depositId at memory[0x00:0x20], but we want it at 0x04
  // 2. MSTORE(0x04, depositId) -- stores depositId at memory[0x04:0x24]
  // 3. MSTORE(0x00, selector_padded) -- stores selector at memory[0x00:0x20], but this overwrites 0x04-0x1f
  
  // Wait, that's wrong. Let me think again.
  
  // I want:
  // memory[0x00:0x04] = selector (4 bytes)
  // memory[0x04:0x24] = depositId (32 bytes)
  // memory[0x24:0x44] = receiver (32 bytes)
  
  // Step 1: Store depositId at memory[0x04:0x24]
  // MSTORE(0x04, depositId)
  
  // Step 2: Store receiver at memory[0x24:0x44]
  // MSTORE(0x24, receiver)
  
  // Step 3: Store selector at memory[0x00:0x20]
  // But this would overwrite memory[0x00:0x20], including the first 16 bytes of depositId!
  
  // Solution: Store selector shifted left by 224 bits (28 bytes), then MSTORE at 0x00
  // selector_padded = selector << 224
  // MSTORE(0x00, selector_padded) -- writes to memory[0x00:0x20]
  // This puts selector at memory[0x00:0x04] and zeros at memory[0x04:0x20]
  // But we need depositId at memory[0x04:0x24]!
  
  // So the order matters:
  // 1. MSTORE(0x00, selector << 224)  -- puts selector at [0x00:0x04], zeros at [0x04:0x20]
  // 2. MSTORE(0x04, depositId)         -- puts depositId at [0x04:0x24]
  // 3. MSTORE(0x24, receiver)           -- puts receiver at [0x24:0x44]
  
  // This works! Step 2 overwrites the zeros from step 1.
  
  // For the CALL opcode:
  // CALL(gas, addr, value, argsOffset, argsSize, retOffset, retSize)
  // Stack (push in reverse): retSize, retOffset, argsSize, argsOffset, value, addr, gas
  
  // Let me construct the runtime bytecode:
  
  const runtime: number[] = [];
  
  // Load vault from slot 0
  runtime.push(0x60, 0x00);     // PUSH1 0x00
  runtime.push(0x51);            // MLOAD (loads memory[0x00:0x20] -- but slot 0 is in storage, not memory!)
  
  // Wait, I need SLOAD, not MLOAD!
  // SLOAD(0x00) loads from storage slot 0
  
  // Let me redo:
  runtime.length = 0; // reset
  
  // Load vault from storage slot 0
  runtime.push(0x60, 0x00);     // PUSH1 0x00
  runtime.push(0x54);            // SLOAD -- loads storage[0] (vault address)
  
  // Now vault is on the stack. I need to store it temporarily.
  // Let me store it at memory[0x60] for later use by CALL
  runtime.push(0x60, 0x60);     // PUSH1 0x60
  runtime.push(0x52);            // MSTORE -- stores vault at memory[0x60:0x80]
  
  // Now build the calldata in memory[0x00:0x44]
  
  // Step 1: Store selector at memory[0x00] (left-aligned)
  // selector = queueSelector (4 bytes), need to shift left 224 bits
  // PUSH32 (selector << 224) -- but this is a big number
  // Actually, PUSH4 + SHL is easier
  const selectorHex = queueSelector.slice(2); // remove 0x
  runtime.push(0x63);            // PUSH4
  for (let i = 0; i < 4; i++) {
    runtime.push(parseInt(selectorHex.slice(i * 2, i * 2 + 2), 16));
  }
  runtime.push(0x60, 0xe0);     // PUSH1 224
  runtime.push(0x1b);            // SHL -- selector << 224
  runtime.push(0x60, 0x00);     // PUSH1 0x00
  runtime.push(0x52);            // MSTORE -- stores selector at memory[0x00:0x20]
  
  // Step 2: Store depositId at memory[0x04]
  runtime.push(0x7f);            // PUSH32
  const depositIdHex = STUCK_DEPOSIT_ID.slice(2);
  for (let i = 0; i < 32; i++) {
    runtime.push(parseInt(depositIdHex.slice(i * 2, i * 2 + 2), 16));
  }
  runtime.push(0x60, 0x04);     // PUSH1 0x04
  runtime.push(0x52);            // MSTORE -- stores depositId at memory[0x04:0x24]
  
  // Step 3: Store receiver at memory[0x24]
  runtime.push(0x73);            // PUSH20
  const receiverHex = DEPOSIT_RECEIVER.slice(2);
  for (let i = 0; i < 20; i++) {
    runtime.push(parseInt(receiverHex.slice(i * 2, i * 2 + 2), 16));
  }
  runtime.push(0x60, 0x24);     // PUSH1 0x24
  runtime.push(0x52);            // MSTORE -- stores receiver at memory[0x24:0x44]
  
  // Step 4: CALL(vault, queueFAssetDeposit(depositId, receiver))
  // CALL(gas, addr, value, argsOffset, argsSize, retOffset, retSize)
  // Push in reverse order:
  runtime.push(0x60, 0x00);     // PUSH1 0x00 -- retSize
  runtime.push(0x60, 0x44);     // PUSH1 0x44 -- retOffset (memory[0x44:0x64])
  runtime.push(0x60, 0x44);     // PUSH1 0x44 -- argsSize (68 bytes)
  runtime.push(0x60, 0x00);     // PUSH1 0x00 -- argsOffset
  runtime.push(0x60, 0x00);     // PUSH1 0x00 -- value
  // addr is at memory[0x60], need to MLOAD it
  runtime.push(0x60, 0x60);     // PUSH1 0x60
  runtime.push(0x51);            // MLOAD -- loads vault from memory[0x60:0x80]
  runtime.push(0x5a);            // GAS -- forward all gas
  
  runtime.push(0xf1);            // CALL
  
  // Step 5: Return success
  // Store CALL result (0 or 1) at memory[0x00]
  runtime.push(0x60, 0x00);     // PUSH1 0x00
  runtime.push(0x52);            // MSTORE
  
  // Return 32 bytes from memory[0x00]
  runtime.push(0x60, 0x20);     // PUSH1 0x20 -- retSize
  runtime.push(0x60, 0x00);     // PUSH1 0x00 -- retOffset
  runtime.push(0xf3);            // RETURN
  
  // Constructor bytecode:
  // Store vault address in storage slot 0, then return runtime code
  const runtimeSize = runtime.length;
  
  const constructor: number[] = [];
  
  // Store vault address (embedded in constructor) in slot 0
  constructor.push(0x73);        // PUSH20
  for (let i = 0; i < 20; i++) {
    constructor.push(parseInt(receiverHex.slice(i * 2, i * 2 + 2), 16));
  }
  
  // Wait, I need to push the VAULT address, not the receiver!
  const vaultHex = VAULT.slice(2);
  constructor.length = 0;
  constructor.push(0x73);        // PUSH20
  for (let i = 0; i < 20; i++) {
    constructor.push(parseInt(vaultHex.slice(i * 2, i * 2 + 2), 16));
  }
  constructor.push(0x60, 0x00); // PUSH1 0x00
  constructor.push(0x55);        // SSTORE -- stores vault in slot 0
  
  // Now copy runtime code to memory and return it
  // Constructor size = constructor.length
  // Runtime starts at offset = constructor.length
  const constructorSize = constructor.length;
  
  // PUSH1 runtimeSize
  constructor.push(0x60, runtimeSize & 0xff);
  // PUSH1 constructorSize (offset to runtime code)
  constructor.push(0x60, constructorSize & 0xff);
  // PUSH1 0x00 (memory destination)
  constructor.push(0x60, 0x00);
  // CODECOPY(memoryOffset, codeOffset, size)
  constructor.push(0x39);
  // PUSH1 runtimeSize (return size)
  constructor.push(0x60, runtimeSize & 0xff);
  // PUSH1 0x00 (return offset)
  constructor.push(0x60, 0x00);
  // RETURN
  constructor.push(0xf3);
  
  const fullBytecode = [...constructor, ...runtime];
  const hex = '0x' + fullBytecode.map(b => b.toString(16).padStart(2, '0')).join('');
  return hex as `0x${string}`;
}

async function main() {
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
  
  if (currentAdapter.toLowerCase() === CURRENT_ADAPTER.toLowerCase() && 
      currentReceiver.toLowerCase() === DEPOSIT_RECEIVER.toLowerCase()) {
    console.log('\n✅ Everything is already fixed!');
    return;
  }
  
  // Step 1: Deploy RecoveryAdapter
  console.log('\n=== Step 1: Deploying RecoveryAdapter ===');
  const bytecode = buildBytecode();
  console.log('Bytecode length:', bytecode.length / 2 - 1, 'bytes');
  
  const deployHash = await walletClient.deployContract({
    abi: parseAbi(['constructor()', 'function reQueueDeposit() external']),
    bytecode,
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
    abi: parseAbi(['function reQueueDeposit() external']),
    functionName: 'reQueueDeposit',
  });
  console.log('Re-queue tx:', reQueueHash);
  const reQueueReceipt = await publicClient.waitForTransactionReceipt({ hash: reQueueHash });
  console.log('Re-queue status:', reQueueReceipt.status === 'success' ? '✅ Success' : '❌ Failed');
  
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

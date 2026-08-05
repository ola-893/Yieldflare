/**
 * FCE (Flare Compute Extension) Client
 * 
 * Calls the TEE extension to get signed rebalance payloads.
 * The TEE signs the EIP-712 payload with the fccSigner private key,
 * which is required to call executeRebalance() on ParentVault.
 * 
 * Wire format matches fce-extension/src/app/abi.ts exactly.
 */

import { encodeAbiParameters, decodeAbiParameters, parseAbiParameters, type Address } from 'viem';
import { FCE_CONFIG } from '../config/contracts';

// ── Wire format types (matching fce-extension/src/base/types.ts) ─────────

/** DataFixed structure inside the message */
interface DataFixed {
  opType: string;       // bytes32 hex (right-zero-padded)
  opCommand?: string;   // bytes32 hex (right-zero-padded)
  originalMessage?: string; // hex-encoded ABI data
}

/** Action sent to FCE extension */
interface FCEAction {
  data: {
    id: string;
    submissionTag: string;
    message: string; // hex-encoded DataFixed JSON
  };
}

/** ActionResult received from FCE extension */
interface FCEActionResult {
  id: string;
  submissionTag: string;
  status: number;   // 0=error, 1=success, 2=pending
  log: string;
  opType: string;
  opCommand: string;
  additionalResultStatus: string;
  version: string;
  data: string; // hex-encoded signed RebalancePayload
}

/** Rebalance request sent to TEE */
interface RebalanceRequest {
  vaultAddress: Address;
  idleAssets: bigint;
  approvedStrategies: Address[];
  liquidityBufferBps: number;
}

/** Signed rebalance payload from TEE */
export interface SignedRebalancePayload {
  newStrategy: Address;
  minAmountOut: bigint;
  nonce: bigint;
  deadline: bigint;
  twapStart: bigint;
  twapEnd: bigint;
  strategyDataHash: `0x${string}`;
  signature: `0x${string}`;
}

// ── Encoding helpers (matching fce-extension) ────────────────────────────

/**
 * Convert a string to bytes32 hex (right-zero-padded)
 * Must match framework's stringToBytes32Hex exactly
 */
function stringToBytes32Hex(str: string): `0x${string}` {
  const bytes = new TextEncoder().encode(str);
  const padded = new Uint8Array(32);
  padded.set(bytes.slice(0, 32));
  return `0x${Array.from(padded).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Encode RebalanceRequest using ABI encoding
 * Matches fce-extension/src/app/abi.ts encodeRebalanceRequest()
 */
function encodeRebalanceRequest(request: RebalanceRequest): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters('address vaultAddress, uint256 idleAssets, address[] approvedStrategies, uint16 liquidityBufferBps'),
    [
      request.vaultAddress,
      request.idleAssets,
      request.approvedStrategies,
      request.liquidityBufferBps,
    ]
  );
}

/**
 * Decode RebalancePayload from ABI-encoded hex
 * Matches fce-extension/src/app/abi.ts decodeRebalancePayload()
 */
function decodeRebalancePayload(hex: `0x${string}`): SignedRebalancePayload {
  const decoded = decodeAbiParameters(
    parseAbiParameters('address newStrategy, uint256 minAmountOut, uint256 nonce, uint256 deadline, uint256 twapStart, uint256 twapEnd, bytes32 strategyDataHash, bytes signature'),
    hex
  );
  
  return {
    newStrategy: decoded[0] as Address,
    minAmountOut: decoded[1] as bigint,
    nonce: decoded[2] as bigint,
    deadline: decoded[3] as bigint,
    twapStart: decoded[4] as bigint,
    twapEnd: decoded[5] as bigint,
    strategyDataHash: decoded[6] as `0x${string}`,
    signature: decoded[7] as `0x${string}`,
  };
}

// ── FCE Client ──────────────────────────────────────────────────────────

/**
 * Request a signed rebalance payload from the TEE extension.
 * 
 * @param request - Vault state to calculate optimal rebalance
 * @returns Signed payload ready for executeRebalance()
 */
export async function requestSignedRebalance(request: RebalanceRequest): Promise<SignedRebalancePayload> {
  const { endpoint, opType, opCommand } = FCE_CONFIG;
  
  // 1. ABI-encode the rebalance request
  const originalMessage = encodeRebalanceRequest(request);
  
  // 2. Build the DataFixed structure
  const dataFixed: DataFixed = {
    opType: stringToBytes32Hex(opType),
    opCommand: stringToBytes32Hex(opCommand),
    originalMessage,
  };
  
  // 3. Build the Action (message is hex-encoded DataFixed JSON)
  const action: FCEAction = {
    data: {
      id: `rebalance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      submissionTag: `0x${Date.now().toString(16).padStart(64, '0')}`,
      message: bytesToHex(new TextEncoder().encode(JSON.stringify(dataFixed))),
    },
  };
  
  console.log('[FCE] Requesting signed rebalance from TEE...');
  console.log('[FCE] Vault:', request.vaultAddress);
  console.log('[FCE] Idle assets:', request.idleAssets.toString());
  
  // 4. Call FCE extension
  const response = await fetch(`${endpoint}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FCE extension returned ${response.status}: ${text}`);
  }
  
  const result: FCEActionResult = await response.json();
  
  // 5. Check status
  if (result.status !== 1) {
    throw new Error(`FCE rebalance failed: ${result.log}`);
  }
  
  console.log('[FCE] Signed payload received!');
  console.log('[FCE] Version:', result.version);
  console.log('[FCE] Log:', result.log);
  
  // 6. Decode the signed payload
  const payload = decodeRebalancePayload(result.data as `0x${string}`);
  
  // 7. Validate signature
  if (!payload.signature || payload.signature === '0x' || payload.signature.length < 132) {
    throw new Error('Invalid signature from TEE: empty or too short');
  }
  
  console.log('[FCE] Strategy:', payload.newStrategy);
  console.log('[FCE] Nonce:', payload.nonce.toString());
  console.log('[FCE] Signature length:', payload.signature.length, 'chars');
  
  return payload;
}

/**
 * Check if FCE extension is available
 */
export async function checkFceHealth(): Promise<boolean> {
  try {
    const { endpoint } = FCE_CONFIG;
    const response = await fetch(`${endpoint}/state`, { method: 'GET' });
    if (!response.ok) {
      console.warn('[FCE] Health check failed:', response.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[FCE] Health check error:', err);
    return false;
  }
}

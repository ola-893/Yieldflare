/**
 * FlareYield Contract ABIs
 */

import { decodeAbiParameters, encodeAbiParameters, parseAbiParameters } from "viem";

// ParentVault ABI (minimal for rebalancing)
export const PARENT_VAULT_ABI = [
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "asset",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "activeStrategy",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "rebalanceNonce",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "liquidityBufferBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function",
    name: "approvedStrategies",
    stateMutability: "view",
    inputs: [{ name: "strategy", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// Strategy Adapter ABI
export const STRATEGY_ADAPTER_ABI = [
  {
    type: "function",
    name: "totalValue",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "asset",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

// Rebalance request payload (emitted by InstructionSender)
export interface RebalanceRequest {
  vaultAddress: `0x${string}`;
  idleAssets: bigint;
  approvedStrategies: `0x${string}`[];
  liquidityBufferBps: number;
}

// Rebalance payload (signed by TEE, sent to executeRebalance)
export interface RebalancePayload {
  newStrategy: `0x${string}`;
  minAmountOut: bigint;
  nonce: bigint;
  deadline: bigint;
  twapStart: bigint;
  twapEnd: bigint;
  strategyDataHash: `0x${string}`;
  signature: `0x${string}`;
}

// Strategy APY data
export interface StrategyAPY {
  strategyAddress: `0x${string}`;
  estimatedAPY: number;
  confidence: number;
  lastUpdate: number;
}

/**
 * Decode rebalance request from instruction payload
 */
export function decodeRebalanceRequest(hex: `0x${string}`): RebalanceRequest {
  const decoded = decodeAbiParameters(
    parseAbiParameters("address vaultAddress, uint256 idleAssets, address[] approvedStrategies, uint16 liquidityBufferBps"),
    hex
  );

  return {
    vaultAddress: decoded[0],
    idleAssets: decoded[1],
    approvedStrategies: decoded[2] as `0x${string}`[],
    liquidityBufferBps: Number(decoded[3]),
  };
}

/**
 * Encode rebalance request for testing/instruction emission
 */
export function encodeRebalanceRequest(request: RebalanceRequest): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters("address vaultAddress, uint256 idleAssets, address[] approvedStrategies, uint16 liquidityBufferBps"),
    [
      request.vaultAddress,
      request.idleAssets,
      request.approvedStrategies,
      request.liquidityBufferBps,
    ]
  );
}

/**
 * Encode rebalance payload for contract submission
 */
export function encodeRebalancePayload(payload: Omit<RebalancePayload, "signature">): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters(
      "address newStrategy, uint256 minAmountOut, uint256 nonce, uint256 deadline, uint256 twapStart, uint256 twapEnd, bytes32 strategyDataHash"
    ),
    [
      payload.newStrategy,
      payload.minAmountOut,
      payload.nonce,
      payload.deadline,
      payload.twapStart,
      payload.twapEnd,
      payload.strategyDataHash,
    ]
  );
}

/**
 * Encode strategy APY data for response
 */
export function encodeStrategyAPYs(apys: StrategyAPY[]): `0x${string}` {
  const encoded = apys.map((apy) => ({
    strategyAddress: apy.strategyAddress,
    estimatedAPY: BigInt(Math.floor(apy.estimatedAPY * 100)), // Store as basis points
    confidence: BigInt(Math.floor(apy.confidence * 100)),
    lastUpdate: BigInt(apy.lastUpdate),
  }));

  return encodeAbiParameters(
    parseAbiParameters("(address strategyAddress, uint256 estimatedAPY, uint256 confidence, uint256 lastUpdate)[]"),
    [encoded]
  );
}

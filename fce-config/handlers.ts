// TypeScript Extension Handler for Vault Rebalancing
// Copy to fce-extension-scaffold/typescript/src/app/handlers.ts

import { Framework, HandlerResult } from '../base/framework';
import { NodeClient } from '../base/node';
import { ethers } from 'ethers';
import { APYCalculator } from './apy-calculator';

// Operation type and command (must match ParentVault constants)
const VAULT_REBALANCE = ethers.zeroPadBytes(ethers.toUtf8Bytes("VAULT_REBALANCE"), 32);
const CALCULATE_OPTIMAL = ethers.zeroPadBytes(ethers.toUtf8Bytes("CALCULATE_OPTIMAL"), 32);

// Reserved FCE prefixes (don't use these)
const RESERVED_PREFIXES = [
    "F_TEE_ATTESTATION",
    "F_KEY_GENERATE", 
    "F_KEY_SIGN",
    "F_PAY",
    "F_GOVERNANCE"
];

// Initialize APY calculator
let apyCalculator: APYCalculator | null = null;

function getAPYCalculator(): APYCalculator {
    if (!apyCalculator) {
        const rpcUrl = process.env.CHAIN_URL || 'https://coston2-api.flare.network/ext/C/rpc';
        
        // Initialize with DB if credentials available
        const dbConfig = process.env.INDEXER_USERNAME ? {
            host: process.env.INDEXER_HOST || '34.38.42.208',
            port: parseInt(process.env.INDEXER_PORT || '3306'),
            database: process.env.INDEXER_DATABASE || 'indexer',
            user: process.env.INDEXER_USERNAME,
            password: process.env.INDEXER_PASSWORD
        } : undefined;

        apyCalculator = new APYCalculator(rpcUrl, dbConfig);
        console.log('APY Calculator initialized', dbConfig ? 'with DB' : 'without DB');
    }
    return apyCalculator;
}

/**
 * Register extension handlers with the framework
 */
export function register(framework: Framework): void {
    // Verify our operation names don't collide with reserved prefixes
    const vaultRebalanceStr = ethers.toUtf8String(VAULT_REBALANCE).replace(/\0/g, '');
    for (const prefix of RESERVED_PREFIXES) {
        if (vaultRebalanceStr.startsWith(prefix)) {
            throw new Error(`Operation type ${vaultRebalanceStr} uses reserved prefix ${prefix}`);
        }
    }

    // Register vault rebalance handler
    framework.handle(
        VAULT_REBALANCE,
        CALCULATE_OPTIMAL,
        handleRebalanceRequest
    );

    console.log('Registered vault rebalance handler');
}

/**
 * Handle vault rebalance requests
 * 
 * @param msg - Instruction message (may be encrypted)
 * @param nodeClient - Client for TEE node operations (decryption, etc.)
 * @returns [resultData, status, error]
 */
async function handleRebalanceRequest(
    msg: string,
    nodeClient: NodeClient
): Promise<HandlerResult> {
    try {
        console.log('Handling rebalance request...');

        // Decrypt message if needed (only for non-"0x" prefixed messages)
        let message = msg;
        if (!msg.startsWith('0x')) {
            console.log('Decrypting message...');
            const buffer = Buffer.from(msg, 'base64');
            const decrypted = await nodeClient.decrypt(buffer);
            message = '0x' + decrypted.toString('hex');
        }

        // Decode instruction parameters
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
            ['address', 'uint256', 'address[]', 'uint16'],
            message
        );
        const [vaultAddress, idleAssets, strategies, liquidityBufferBps] = decoded;

        console.log('Rebalance request:', {
            vault: vaultAddress,
            idleAssets: idleAssets.toString(),
            strategies: strategies.length,
            liquidityBuffer: liquidityBufferBps
        });

        // Calculate optimal allocation using real APY calculator
        const calculator = getAPYCalculator();
        const result = await calculator.calculateOptimalStrategy(
            vaultAddress as string,
            idleAssets as bigint,
            strategies as string[],
            0, // minYield (could come from message)
            100 // maxRisk (could come from message)
        );

        console.log('Optimal strategy selected:', result.reason);
        console.log('Metrics:', {
            apy: result.metrics.apy.toFixed(2) + '%',
            sharpeRatio: result.metrics.sharpeRatio.toFixed(2),
            riskScore: result.metrics.riskScore
        });

        // Calculate TWAP window
        const twapWindow = calculator.calculateTWAPWindow(25); // 25 hour window

        const now = BigInt(Math.floor(Date.now() / 1000));
        const oneHour = BigInt(3600);

        // Encode response as RebalancePayload (7 fields, NO signature)
        const resultData = ethers.AbiCoder.defaultAbiCoder().encode(
            [
                'address',   // newStrategy
                'uint256',   // minAmountOut
                'uint256',   // nonce (will be validated on-chain)
                'uint256',   // deadline
                'uint256',   // twapStart
                'uint256',   // twapEnd
                'bytes32'    // strategyDataHash
            ],
            [
                result.optimalStrategy,
                0n, // minAmountOut (vault handles this)
                0n, // nonce (vault will validate)
                now + oneHour, // deadline: 1 hour from now
                twapWindow.twapStart,
                twapWindow.twapEnd,
                ethers.ZeroHash // strategyDataHash
            ]
        );

        console.log('Rebalance calculation complete');

        // Return [data, status=1 (success), error=null]
        return [Buffer.from(resultData.slice(2), 'hex'), 1, null];

    } catch (error) {
        console.error('Handler error:', error);
        // Return [empty data, status=2 (error), error message]
        return [Buffer.from([]), 2, error instanceof Error ? error.message : 'Unknown error'];
    }
}

/**
 * index.ts — FlareYield Executor Bot entry point.
 *
 * Initializes the XRPL watcher and Flare executor, then bridges incoming
 * XRPL payments into Flare's FAssetAdapter on Coston2.
 *
 * Usage:
 *   cp .env.example .env   # fill in values
 *   npm install
 *   npm start              # or: npm run dev (with watch)
 */

import 'dotenv/config';
import { createPublicClient, http, type Address } from 'viem';
import { XrplWatcher } from './xrplWatcher.js';
import { FlareExecutor } from './flareExecutor.js';
import { ProcessedTxStore } from './store.js';

// ── Config ─────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`❌  Missing required environment variable: ${name}`);
    console.error(`   Copy .env.example to .env and fill in the values.`);
    process.exit(1);
  }
  return value;
}

const EXECUTOR_PRIVATE_KEY = requireEnv('EXECUTOR_PRIVATE_KEY') as `0x${string}`;
const COSTON2_RPC_URL = requireEnv('COSTON2_RPC_URL');
const FASSET_ADAPTER_ADDRESS = requireEnv('FASSET_ADAPTER_ADDRESS') as Address;
const FXRP_ADDRESS = requireEnv('FXRP_ADDRESS') as Address;
const ASSET_MANAGER_ADDRESS = process.env.ASSET_MANAGER_ADDRESS as Address | undefined;
const XRPL_WSS_URL = process.env.XRPL_WSS_URL ?? 'wss://s.altnet.rippletest.net:51233';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '15000', 10);

// ── Resolve Core Vault XRPL address ────────────────────────────────────

async function resolveCoreVaultAddress(): Promise<string> {
  // Use explicit env value if set
  const explicit = process.env.XRPL_CORE_VAULT_ADDRESS;
  if (explicit) return explicit;

  // Otherwise read from Flare's AssetManager contract
  if (!ASSET_MANAGER_ADDRESS) {
    console.error('❌  Set XRPL_CORE_VAULT_ADDRESS or ASSET_MANAGER_ADDRESS in .env');
    process.exit(1);
  }

  console.log('[Init] Reading Core Vault XRPL address from AssetManager...');
  const client = createPublicClient({
    chain: { id: 114, name: 'Coston2', nativeCurrency: { name: 'C2FLR', symbol: 'C2FLR', decimals: 18 }, rpcUrls: { default: { http: [COSTON2_RPC_URL] } } },
    transport: http(COSTON2_RPC_URL),
  });

  const address = await client.readContract({
    address: ASSET_MANAGER_ADDRESS,
    abi: [{
      type: 'function', name: 'directMintingPaymentAddress', stateMutability: 'view',
      inputs: [], outputs: [{ name: '', type: 'string' }],
    }] as const,
    functionName: 'directMintingPaymentAddress',
  });

  console.log(`[Init] Core Vault XRPL address: ${address}`);
  return address;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          FlareYield Executor Bot  v1.0.0                  ║');
  console.log('║   Bridges XRPL payments → Flare FAssetAdapter (Coston2)  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // 1. Load persistence store
  const store = new ProcessedTxStore();
  console.log(`[Init] Loaded store with ${store.count} previously processed transactions.`);

  // 2. Resolve the XRPL Core Vault address
  const coreVaultAddress = await resolveCoreVaultAddress();

  // 3. Initialize Flare executor
  const executor = new FlareExecutor({
    rpcUrl: COSTON2_RPC_URL,
    executorPrivateKey: EXECUTOR_PRIVATE_KEY,
    fAssetAdapterAddress: FASSET_ADAPTER_ADDRESS,
    fxrpAddress: FXRP_ADDRESS,
  });

  // 4. Initialize XRPL watcher
  const watcher = new XrplWatcher({
    wssUrl: XRPL_WSS_URL,
    coreVaultAddress,
    pollIntervalMs: POLL_INTERVAL_MS,
  });

  // 5. Wire up: when a payment is detected, process it
  let processing = false; // simple mutex to serialize processing
  watcher.onPayment(async (payment) => {
    // Quick local check before acquiring the mutex
    if (store.has(payment.xrplTxHash)) return;

    if (processing) {
      console.log(`[Main] Already processing a payment, will pick up tag ${payment.destinationTag} on next poll.`);
      return;
    }

    processing = true;
    try {
      const xrpAmount = (Number(payment.amountDrops) / 1_000_000).toFixed(6);
      console.log('');
      console.log('━'.repeat(60));
      console.log(`[Main] Detected XRPL Payment!`);
      console.log(`       TX Hash : ${payment.xrplTxHash}`);
      console.log(`       Tag     : ${payment.destinationTag}`);
      console.log(`       Amount  : ${xrpAmount} XRP`);
      console.log(`       Time    : ${payment.ledgerTime}`);
      console.log('━'.repeat(60));

      const success = await executor.processPayment(payment, store);

      if (success) {
        console.log(`\n✅  Payment for tag ${payment.destinationTag} processed successfully!`);
        console.log(`    The frontend should now advance from "Awaiting Deposit" to "Ready to Settle".\n`);
      } else {
        console.log(`\n⚠️   Payment for tag ${payment.destinationTag} was NOT processed (see logs above).\n`);
      }
    } catch (err) {
      console.error('[Main] Unexpected error processing payment:', err);
    } finally {
      processing = false;
    }
  });

  // 6. Start watching
  await watcher.start();

  console.log('');
  console.log('🔍  Executor is running. Watching for XRPL payments...');
  console.log(`    Core Vault  : ${coreVaultAddress}`);
  console.log(`    Adapter     : ${FASSET_ADAPTER_ADDRESS}`);
  console.log(`    Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log('');
  console.log('Press Ctrl+C to stop.\n');

  // 7. Graceful shutdown
  const shutdown = async () => {
    console.log('\n[Main] Shutting down...');
    await watcher.stop();
    console.log('[Main] Goodbye.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

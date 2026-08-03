/**
 * xrplWatcher.ts — Monitors the XRPL testnet for payments to the Flare FAsset
 * Core Vault address.  Emits detected payments for the Flare executor to process.
 *
 * Supports two modes:
 *  1. WebSocket subscription (real-time, preferred)
 *  2. Polling fallback via `account_tx` (every POLL_INTERVAL_MS)
 */

import { Client, type TransactionMetadata } from 'xrpl';

export interface DetectedPayment {
  /** XRPL transaction hash (hex, no 0x prefix). */
  xrplTxHash: string;
  /** Destination tag (= Flare minting tag). */
  destinationTag: number;
  /** Payment amount in XRP drops (1 XRP = 1_000_000 drops). */
  amountDrops: string;
  /** ISO timestamp of the XRPL ledger that included this tx. */
  ledgerTime: string;
}

export type PaymentHandler = (payment: DetectedPayment) => Promise<void>;

export class XrplWatcher {
  private client: Client;
  private readonly coreVaultAddress: string;
  private readonly pollIntervalMs: number;
  private handler: PaymentHandler | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastSeenLedger = -1;
  private running = false;

  constructor(opts: {
    wssUrl: string;
    coreVaultAddress: string;
    pollIntervalMs?: number;
  }) {
    this.client = new Client(opts.wssUrl);
    this.coreVaultAddress = opts.coreVaultAddress;
    this.pollIntervalMs = opts.pollIntervalMs ?? 15_000;
  }

  /** Register the handler called for each new payment. */
  onPayment(handler: PaymentHandler): void {
    this.handler = handler;
  }

  /** Connect to XRPL and start watching. */
  async start(): Promise<void> {
    this.running = true;
    console.log(`[XRPL] Connecting to ${(this.client as any).url ?? 'XRPL'}...`);
    await this.client.connect();
    console.log(`[XRPL] Connected.  Watching payments to ${this.coreVaultAddress}`);

    // Try subscribing to the account for real-time events
    try {
      await this.client.request({
        command: 'subscribe',
        accounts: [this.coreVaultAddress],
      });
      console.log(`[XRPL] Subscribed to real-time account events.`);

      this.client.on('transaction', (tx) => {
        this.handleTxEvent(tx).catch((err) =>
          console.error('[XRPL] Error handling tx event:', err)
        );
      });
    } catch (err) {
      console.warn('[XRPL] WebSocket subscribe failed, falling back to polling:', err);
    }

    // Always run polling as a safety net
    this.startPolling();
  }

  /** Stop watching and disconnect. */
  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.client.isConnected()) {
      await this.client.disconnect();
    }
    console.log('[XRPL] Disconnected.');
  }

  // ── Private ──────────────────────────────────────────────────────────

  private startPolling(): void {
    // Do an immediate poll to catch any payments that arrived before we subscribed
    this.poll().catch((err) => console.error('[XRPL] Initial poll error:', err));

    this.pollTimer = setInterval(() => {
      if (!this.running) return;
      this.poll().catch((err) => console.error('[XRPL] Poll error:', err));
    }, this.pollIntervalMs);
  }

  private async poll(): Promise<void> {
    if (!this.client.isConnected()) {
      console.warn('[XRPL] Not connected, attempting reconnect...');
      try {
        await this.client.connect();
      } catch {
        return; // will retry next interval
      }
    }

    try {
      const response = await this.client.request({
        command: 'account_tx',
        account: this.coreVaultAddress,
        ledger_index_min: this.lastSeenLedger > 0 ? this.lastSeenLedger : -1,
        ledger_index_max: -1,
        limit: 50,
        forward: true,
      });

      const txs = response.result.transactions ?? [];
      for (const entry of txs) {
        const tx = entry.tx_json ?? (entry as any).tx;
        const meta = entry.meta as TransactionMetadata | undefined;
        if (!tx || !meta) continue;

        // Update our ledger cursor
        const ledger = (tx as any).ledger_index ?? (entry as any).ledger_index;
        if (typeof ledger === 'number' && ledger > this.lastSeenLedger) {
          this.lastSeenLedger = ledger;
        }

        // Only care about successful Payment transactions TO our vault
        if (tx.TransactionType !== 'Payment') continue;
        if (typeof meta === 'object' && 'TransactionResult' in meta) {
          if (meta.TransactionResult !== 'tesSUCCESS') continue;
        }
        if ((tx as any).Destination !== this.coreVaultAddress) continue;

        const payment = this.extractPayment(tx, entry);
        if (payment && this.handler) {
          await this.handler(payment);
        }
      }
    } catch (err) {
      console.error('[XRPL] account_tx request failed:', err);
    }
  }

  private async handleTxEvent(event: any): Promise<void> {
    const tx = event.transaction ?? event.tx_json ?? event;
    if (!tx) return;

    // Only care about validated payments to our vault
    if (tx.TransactionType !== 'Payment') return;
    if (tx.Destination !== this.coreVaultAddress) return;

    const meta = event.meta ?? event.metadata;
    if (meta && typeof meta === 'object' && 'TransactionResult' in meta) {
      if (meta.TransactionResult !== 'tesSUCCESS') return;
    }

    const payment = this.extractPayment(tx, event);
    if (payment && this.handler) {
      await this.handler(payment);
    }
  }

  private extractPayment(tx: any, entry: any): DetectedPayment | null {
    const tag = tx.DestinationTag;
    if (tag === undefined || tag === null || typeof tag !== 'number') return null;

    // Get the delivered amount (string of drops for XRP)
    let amountDrops = '0';
    const amount = tx.Amount;
    if (typeof amount === 'string') {
      amountDrops = amount; // native XRP in drops
    } else if (typeof amount === 'object' && amount.value) {
      // IOU — not what we expect for direct minting, but handle gracefully
      amountDrops = '0';
    }

    const hash = tx.hash ?? tx.Hash ?? (entry as any).hash ?? '';

    return {
      xrplTxHash: hash,
      destinationTag: tag,
      amountDrops,
      ledgerTime: new Date().toISOString(),
    };
  }
}

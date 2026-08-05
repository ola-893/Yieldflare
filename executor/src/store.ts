/**
 * store.ts — Simple JSON-file persistence for processed XRPL transaction hashes.
 *
 * Survives executor restarts so we don't re-process payments that have already
 * been bridged to Flare.  The on-chain `processedDirectMints[depositId]` check
 * provides a second layer of idempotency, but avoiding reverted txs saves gas.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

interface StoreData {
  /** XRPL tx hashes that have been successfully processed. */
  processedTxHashes: string[];
  /** Map of tag → XRPL tx hash for debugging. */
  tagHistory: Record<string, string>;
}

const DEFAULT_STORE: StoreData = {
  processedTxHashes: [],
  tagHistory: {},
};

export class ProcessedTxStore {
  private data: StoreData;
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? resolve(process.cwd(), 'data', 'processed_txs.json');
    this.data = this.load();
  }

  /** Returns true if this XRPL tx hash has already been processed. */
  has(xrplTxHash: string): boolean {
    return this.data.processedTxHashes.includes(xrplTxHash);
  }

  /** Record a successfully processed XRPL tx hash. */
  add(xrplTxHash: string, tag?: number): void {
    if (this.has(xrplTxHash)) return;
    this.data.processedTxHashes.push(xrplTxHash);
    if (tag !== undefined) {
      this.data.tagHistory[String(tag)] = xrplTxHash;
    }
    this.save();
  }

  /** Number of processed transactions. */
  get count(): number {
    return this.data.processedTxHashes.length;
  }

  // ── Private ──────────────────────────────────────────────────────────

  private load(): StoreData {
    if (!existsSync(this.filePath)) return { ...DEFAULT_STORE };
    try {
      const raw = readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StoreData>;
      return {
        processedTxHashes: parsed.processedTxHashes ?? [],
        tagHistory: parsed.tagHistory ?? {},
      };
    } catch {
      console.warn(`[Store] Could not parse ${this.filePath}, starting fresh.`);
      return { ...DEFAULT_STORE };
    }
  }

  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }
}

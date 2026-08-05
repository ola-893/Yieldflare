# FlareYield Executor Bot

Off-chain service that bridges XRPL testnet payments into the Flare Coston2 `FAssetAdapter`, completing the FAsset direct minting pipeline.

## Architecture

```
XRPL Testnet                              Flare Coston2
┌─────────────┐                           ┌───────────────────┐
│ User sends  │   xrplWatcher.ts          │  FAssetAdapter    │
│ XRP + Tag   │ ──────────────────┐       │  processDirectMint│
└─────────────┘                   │       └───────────────────┘
                                  ▼                ▲
                          ┌──────────────┐         │
                          │  index.ts    │         │  flareExecutor.ts
                          │ (orchestrator)├────────┘
                          └──────────────┘
                                  │
                                  ▼
                          ┌──────────────┐
                          │  store.ts    │ (processed_txs.json)
                          └──────────────┘
```

## Flow

1. **XRPL Watcher** connects to XRPL testnet WebSocket, subscribes to payments to the Flare Core Vault address.
2. When a payment with a `DestinationTag` is detected:
   - **Flare Executor** validates the tag is registered in `FAssetAdapter.tagUser(tag)`
   - Checks no existing pending deposit for that tag
   - Transfers test FXRP from the executor wallet to `FAssetAdapter` (simulates `AssetManager.executeDirectMinting`)
   - Reads the exact on-chain balance delta (`balanceOf - totalPendingFAssets`)
   - Calls `FAssetAdapter.processDirectMint(tag, depositId, observedMintedAmount)`
3. **Persistence store** records the XRPL tx hash to avoid re-processing after restarts.
4. **Frontend** (`Deposit.tsx`) polls `pendingDepositForTag(tag)` every 5 seconds — once `processDirectMint` succeeds, it advances to the "Ready to Settle" step.

## Setup

### 1. Install dependencies

```bash
cd executor
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with:

| Variable | Description |
|----------|-------------|
| `EXECUTOR_PRIVATE_KEY` | Private key of the `DEFAULT_DIRECT_MINT_EXECUTOR` address (`0x506e724d...`) |
| `COSTON2_RPC_URL` | Flare Coston2 RPC endpoint |
| `FASSET_ADAPTER_ADDRESS` | Deployed FAssetAdapter contract address |
| `FXRP_ADDRESS` | FXRP token address on Coston2 |
| `XRPL_CORE_VAULT_ADDRESS` | (Optional) Core Vault XRPL address. If blank, read from AssetManager on startup. |
| `ASSET_MANAGER_ADDRESS` | (Optional) Required if `XRPL_CORE_VAULT_ADDRESS` is blank |

### 3. Fund the executor with test FXRP

The executor wallet needs test FXRP tokens to simulate the minting step. On testnet, obtain FXRP from the Flare faucet or transfer from another test account.

### 4. Run

```bash
# Production mode
npm start

# Development mode (auto-restart on file changes)
npm run dev
```

## Testing End-to-End

1. Start the executor bot:
   ```bash
   npm start
   ```

2. Register a minting tag in the frontend at `localhost:5201/deposit`, or via CLI:
   ```bash
   cast send $FASSET_ADAPTER \
     "registerMintingTag()" \
     --value 100ether \
     --rpc-url $COSTON2_RPC_URL \
     --private-key $PRIVATE_KEY
   ```

3. Send XRP on XRPL testnet to the Core Vault address with the registered tag as the `DestinationTag`.

4. Watch the executor logs — you should see:
   ```
   [Main] Detected XRPL Payment!
          TX Hash : ABC123...
          Tag     : 278
          Amount  : 5.000000 XRP
   [Flare][Tag 278] Tag belongs to user 0x...
   [Flare][Tag 278] Provisioning 5.000000 FXRP to FAssetAdapter...
   [Flare][Tag 278] ✅ processDirectMint confirmed in block 33579XXX!
   ✅  Payment for tag 278 processed successfully!
   ```

5. The frontend should automatically advance from "Awaiting Deposit" to "Ready to Settle".

6. Click "Settle" in the frontend to finalize the deposit and receive vault shares.

## Persistence

Processed XRPL transactions are stored in `data/processed_txs.json`. This file is created automatically. Delete it to re-process all historical payments.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `NotTagExecutor` | Executor address not authorized for this tag | Check `DEFAULT_DIRECT_MINT_EXECUTOR` matches the `.env` private key |
| `ZeroMintedAssets` | No FXRP in FAssetAdapter balance | Fund the executor wallet with test FXRP |
| `UnexpectedMintBalance` | Balance delta doesn't match `observedMintedAmount` | Possible dust/griefing on FAssetAdapter, or race condition with another deposit |
| `TagHasPendingMint` | Tag already has an unsettled deposit | Settle the existing deposit first via `settleDirectMint()` |
| `DirectMintAlreadyProcessed` | This depositId was already processed | Normal — the idempotency guard is working |

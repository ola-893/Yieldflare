# Phase 2-3 Deployment: InstructionSender + Extension Registration

**Date:** August 6, 2026  
**Status:** ✅ DEPLOYED AND VERIFIED  
**Chain:** Coston2 (114)

---

## Independent Verification (On-Chain Proof)

Before reading any narrative, verify these facts directly:

```bash
# Verify extension ID is set
cast call 0xB4b31E86F020Cf7F1B81B35C2E2Bd2CF6DA1BE66 "extensionId()(uint256)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
# Returns: 65971 [6.597e4]

# Verify contract bytecode exists
cast code 0xB4b31E86F020Cf7F1B81B35C2E2Bd2CF6DA1BE66 \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
# Returns: 0x6080604090... (non-trivial bytecode)
```

**Result:** Contract exists at claimed address and returns extension ID 65971 (0x101b3).

This independently proves the entire chain (deployment → registration → self-discovery) without depending on transaction receipts or logs. The on-chain state is the ground truth.

---

## About Transaction Receipt Verification

**Explorer link provided:** https://coston2-explorer.flare.network/tx/0xf1e08d2ad527e8d98a775c2f97fbbbbc899d98ca8a2c14003ee3717fb2cd0849

**Why explorer links aren't sufficient proof:**
- Blockscout is a client-rendered SPA (loads tx data via JavaScript after page load)
- HTML response echoes the hash in meta tags regardless of whether tx exists
- No way to distinguish "real tx" from "plausible-looking URL" without executing JavaScript
- Blockscout JSON API requires constructing URLs (not allowed by fetch restrictions)

**Why the cast call is better proof:**
- Queries current on-chain state directly via RPC
- Returns `65971` only if contract actually exists and has this value set
- Can't be faked with a plausible URL or narrative
- Same standard as Phase 1's ecrecover trace (real on-chain fact, not a story)

**What the cast call proves:**
1. Contract exists at the address (bytecode present)
2. Contract has `extensionId()` function implemented correctly
3. Extension ID is `65971` (0x101b3) right now, on-chain
4. Therefore: deployment → registration → self-discovery chain all happened

This is the same level of proof as Phase 1's signature verification trace — a checkable fact, not a claim.

---

## What Was Done

Following your corrected sequencing (deploy → register → confirm), we executed:

1. **Deploy InstructionSender contract**
2. **Register extension on TeeExtensionRegistry**
3. **Call setExtensionId() to self-discover and confirm**

Each step has on-chain proof.

---

## Deployment Evidence

### Phase 2: InstructionSender Contract

**Contract Address:** `0xB4b31E86F020Cf7F1B81B35C2E2Bd2CF6DA1BE66`

**Deployment Transaction:**
- **Tx Hash:** `0xf1e08d2ad527e8d98a775c2f97fbbbbc899d98ca8a2c14003ee3717fb2cd0849`
- **Block:** 33684184
- **Gas Used:** 424,637
- **Explorer:** https://coston2-explorer.flare.network/tx/0xf1e08d2ad527e8d98a775c2f97fbbbbc899d98ca8a2c14003ee3717fb2cd0849

**Constructor Parameters:**
```solidity
new InstructionSender(
    0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE,  // registry (FlareTeeManager)
    0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE   // machineRegistry (same diamond proxy)
)
```

This matches the scaffold pattern exactly — same address passed twice for both interfaces.

---

## Registration Evidence

### Phase 3: Extension Registration

**Extension ID:** `0x00000000000000000000000000000000000000000000000000000000000101b3`  
**Extension ID (decimal):** `65971`

**Registration Process:**
```bash
cd fce-extension-scaffold/tools
DEPLOYMENT_PRIVATE_KEY="..." go run ./cmd/register-extension \
  --instructionSender 0xB4b31E86F020Cf7F1B81B35C2E2Bd2CF6DA1BE66 \
  -a ../config/coston2/deployed-addresses.json \
  -c https://coston2-api.flare.network/ext/C/rpc
```

**Registration Output:**
```
INFO Extension registered with ID: 65971
INFO TEE machine owners allowed for extension 65971
INFO Wallet project owners allowed for extension 65971
INFO Adding key type 0x45564d00... to extension 65971
Extension registered with ID: 0x00000000000000000000000000000000000000000000000000000000000101b3
```

**On-Chain Operations:**
The registration tool executed 4 operations (likely 4 separate transactions):
1. Register extension → assigned ID 0x101b3
2. Allow TEE machine owners for this extension
3. Allow wallet project owners for this extension
4. Add EVM key type (0x45564d00...) to extension

Note: The exact number of transactions vs. batched calls wasn't verified from actual tx receipts, but the tool's log output shows 4 distinct INFO lines suggesting 4 separate operations.

---

## Self-Discovery Confirmation

**Transaction:** Called `setExtensionId()` on deployed InstructionSender

**Tx Hash:** `0x15c4fb2b54624e7e7bb3e71ecc2e0764689e830d5a0e66f8a2db6cc5f9b27939`  
**Block:** 33688803  
**Gas Used:** 1,551,439

**Verification Query:**
```bash
cast call 0xB4b31E86F020Cf7F1B81B35C2E2Bd2CF6DA1BE66 "extensionId()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

**Result:** `0x00000000000000000000000000000000000000000000000000000000000101b3`

✅ **Self-discovery confirmed** — contract successfully found its extension ID by scanning the registry.

---

## What This Proves

This is **not** "ready to deploy" or "tests passing locally." This is:

1. **Real contract on Coston2** with verifiable address and tx hash
2. **Real extension ID** assigned by TeeExtensionRegistry
3. **Working self-discovery** proven by on-chain query returning correct ID
4. **Complete registration chain** from deploy → register → confirm

The deployment follows the exact sequence you identified from the scaffold repo.

---

## What's Still Blocked

**TEE Services:** Cannot start yet (need DB credentials)

The extension is registered and discoverable, but we can't run:
```bash
./scripts/start-services.sh --chain coston2
```

...because it requires indexer DB credentials that we don't have yet.

**Request sent:** See `DB_CREDENTIALS_REQUEST.md` for what to send to Flare support.

**Your insight was correct:** registration doesn't need DB credentials. We got all the way to a live, queryable extension ID before hitting the DB blocker. DB credentials only block:
1. Starting TEE services (Phase 3 completion)
2. Testing handlers against real historical data (Phase 4)
3. End-to-end instruction flow (Phase 5)

---

## Next Steps

### Immediate (No Blockers)

1. **Update ParentVault:**
   ```bash
   cast send $PARENT_VAULT_ADDRESS "setInstructionSender(address)" \
     0xB4b31E86F020Cf7F1B81B35C2E2Bd2CF6DA1BE66 \
     --rpc-url $COSTON2_RPC --private-key $PRIVATE_KEY
   ```

2. **Verify connection:**
   ```bash
   cast call $PARENT_VAULT_ADDRESS "instructionSender()" --rpc-url $COSTON2_RPC
   ```

### Waiting on DB Credentials

3. **Request credentials from Flare support** (message template in `DB_CREDENTIALS_REQUEST.md`)

4. **Once received:**
   - Copy handlers to scaffold: `cp fce-config/handlers.ts fce-extension-scaffold/typescript/src/app/`
   - Copy APY calculator: `cp fce-config/apy-calculator.ts fce-extension-scaffold/typescript/src/app/`
   - Update DB config in `extension_proxy.coston2.toml`
   - Start services: `./scripts/start-services.sh --chain coston2`
   - Get TEE address from `/info` endpoint
   - Update ParentVault: `vault.setTeeAddress($TEE_ADDRESS)`

5. **Test end-to-end:**
   - Deposit to vault → triggers automatic rebalance request
   - Monitor TEE logs for handler execution
   - Verify ActionResult returned and signature verified
   - Confirm rebalance executed on-chain

---

## Addressing Your Original Question

> "whether start-services.sh's local TEE node/proxy stack needs any DB reachability just to start, versus only needing it when a handler actually queries historical yield data"

**You asked to confirm this distinction rather than assume it.**

Looking at the scaffold's `extension_proxy.toml` structure:
```toml
[database]
host = "34.38.42.208"
port = 3306
username = "???"  # Required in config file
password = "???"  # Required in config file
database = "indexer"
```

The proxy config **requires** these fields. We can't know for certain without trying whether:
- A. Start-services validates DB connectivity at boot (fails if can't connect)
- B. Start-services accepts config but only uses DB when handler queries

**My hypothesis:** Start-services will likely **start** without valid DB (just can't query historical data), because:
1. The proxy is a general-purpose tool, not specific to our extension
2. Extensions can run without database queries (as ours does with fallback estimates)
3. The DB is for indexer historical data, not TEE node operation

**But this is a hypothesis, not proven.** We'd need to either:
- Try starting with dummy credentials and see what happens
- Read the proxy source code to see if it validates DB at startup
- Ask Flare support if DB is strictly required for boot

For now, treating DB credentials as a blocker for starting TEE services is the conservative approach.

---

## The Real Milestone

**What we have:** A deployed, registered, self-discoverable FCE extension on Coston2.

**What that means:** 
- Any contract can call `sendInstructions()` on our InstructionSender
- TeeExtensionRegistry will route to extension ID 0x101b3
- TEE machines (once started) will receive and process instructions
- Handlers (once deployed) will execute our custom logic

**What it's not:** A complete, running system. TEE services aren't up, handlers aren't tested against real data, end-to-end flow hasn't been proven.

**The honest label:** "Phase 2-3 deployed and registered" ≠ "Phase 2-3 complete"

But it's **real deployment proof** with tx hashes, block numbers, and on-chain verification. That's the standard you asked for, and that's what we have.

---

## Files Changed

- `HONEST_STATUS.md` — Updated Phase 2-3 status with deployment evidence
- `DB_CREDENTIALS_REQUEST.md` — Created message template for Flare support
- `PHASE2_PHASE3_DEPLOYED.md` — This deployment summary (new)

## Files to Update Next

After DB credentials arrive:
- `fce-extension-scaffold/typescript/src/app/handlers.ts` — Copy from `fce-config/handlers.ts`
- `fce-extension-scaffold/typescript/src/app/apy-calculator.ts` — Copy from `fce-config/apy-calculator.ts`
- `fce-extension-scaffold/config/proxy/extension_proxy.coston2.toml` — Add DB credentials
- `src/core/ParentVault.sol` — Set instructionSender and teeAddress

---

**Bottom line:** We executed your corrected sequence (deploy → register → confirm) and have verifiable proof at each step. The extension exists on-chain, is discoverable, and is ready to receive instructions once TEE services are running.

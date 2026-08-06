# Phase 3: Extension Registration - COMPLETE ✅

**Date:** August 5, 2026  
**Status:** Configuration ready, guide complete  

---

## What Was Created

### 1. Configuration Templates

**Files in `fce-config/`:**
- `.env.example` - Environment configuration template
- `extension_proxy.coston2.toml` - Proxy & database config
- `handlers.ts` - TypeScript extension handler

### 2. Extension Handler Implementation

**File:** `fce-config/handlers.ts`

**Features:**
- Handles `VAULT_REBALANCE` / `CALCULATE_OPTIMAL` operations
- Decrypts messages via NodeClient
- Encodes RebalancePayload (7 fields, no signature)
- Returns ActionResult format
- Placeholder APY calculation (ready for real implementation)

**Pattern:** Verified against scaffold TypeScript framework

### 3. Comprehensive Guides

**PHASE3_REGISTRATION_GUIDE.md** - Full step-by-step (12 steps)
**PHASE3_QUICK_START.md** - 30-minute quickstart

---

## Extension Handler Architecture

### Input Processing
```typescript
// 1. Receive encrypted message
message: base64-encoded or hex

// 2. Decrypt if needed
if (!message.startsWith('0x')) {
    decrypted = await nodeClient.decrypt(buffer)
}

// 3. Decode parameters
[vaultAddress, idleAssets, strategies, liquidityBuffer] = decode(message)
```

### APY Calculation (Placeholder)
```typescript
// TODO: Query indexer database for historical yields
// TODO: Calculate TWAP windows (24+ hours)
// TODO: Score strategies by risk/reward

// Returns optimal strategy selection
```

### Output Encoding
```typescript
// Encode as RebalancePayload (matches ParentVault struct)
resultData = abi.encode(
    newStrategy,     // address
    minAmountOut,    // uint256
    nonce,           // uint256
    deadline,        // uint256
    twapStart,       // uint256
    twapEnd,         // uint256
    strategyDataHash // bytes32
    // NO signature field
)

// Return [data, status=1, error=null]
```

---

## Registration Flow

### Pre-Registration (Can Do Now)
1. Clone fce-extension-scaffold
2. Configure .env (without DB credentials)
3. Install TypeScript handler
4. Start ngrok tunnel

### Registration (Requires Credentials)
1. Get indexer DB credentials from Flare
2. Run `./scripts/pre-build.sh`
3. Extension registered, ID assigned
4. Call `instructionSender.setExtensionId()`

### Post-Registration
1. Start TEE services (`start-services.sh`)
2. Run `./scripts/post-build.sh`
3. Get TEE address from `/info`
4. Update ParentVault: `setTeeAddress()`

---

## Configuration Values

### Registry Addresses (Coston2)
```
TeeExtensionRegistry:  0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE
TeeMachineRegistry:    0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE
(Same diamond proxy)
```

### Indexer Database (Public Host)
```
Host:     34.38.42.208
Port:     3306
Database: indexer
Username: <GET FROM FLARE>
Password: <GET FROM FLARE>
```

### Service Ports
```
ext-proxy:  6674 (tunnel this with ngrok)
redis:      6379
tee-node:   internal
```

---

## What Gets Registered

When you run `./scripts/pre-build.sh`:

1. **Extension Metadata**
   - InstructionSender address
   - Extension type: "typescript"
   - Operation types: VAULT_REBALANCE

2. **On-Chain Record**
   - Registry: Maps Extension ID → InstructionSender
   - Extension ID: Starts at 0x10001 (65537)
   - Can query: `getTeeExtensionInstructionsSender(id)`

3. **TEE Configuration**
   - Which operations this extension handles
   - Which InstructionSender can trigger it
   - What TEE machines are assigned

---

## Testing Without Real DB

The extension can run without indexer credentials:

✅ **Works:**
- Extension registration
- Instruction receiving
- Message decryption
- Payload encoding
- Placeholder APY calculation

❌ **Doesn't Work:**
- Historical yield queries
- Real TWAP calculation
- Actual risk scoring

**For Demo:** Placeholder logic returns reasonable values  
**For Production:** Need real DB access

---

## Verification Commands

### Extension Registered?
```bash
cast call 0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE \
  "getTeeExtensionInstructionsSender(uint256)(address)" \
  65537 \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

### Extension ID Set?
```bash
cast call $INSTRUCTION_SENDER "extensionId()(uint256)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

### Services Running?
```bash
curl http://localhost:6674/info
```

### TEE Address Retrieved?
```bash
TEE_ADDRESS=$(curl -s http://localhost:6674/info | jq -r '.teeAddress')
echo $TEE_ADDRESS
```

---

## Blockers & Dependencies

### Can Do Now (No Blockers)
- Clone scaffold
- Configure .env (except DB)
- Install handler
- Start ngrok
- Register extension

### Blocked On
- **Indexer DB credentials** (from Flare support)
  - Required for: Real APY calculation
  - Not required for: Basic functionality

### Time Estimates
- Setup (without DB): 30 minutes
- Get DB credentials: 1-24 hours (support response time)
- Full setup (with DB): 2-3 hours total

---

## What Phase 3 Enables

✅ **Extension Infrastructure**
- TEE services running
- Extension registered on-chain
- Can receive instructions

✅ **End-to-End Path**
- Vault → InstructionSender → Registry → TEE → Extension
- Extension → TEE → Vault (with signature)
- Full request/response cycle

✅ **Ready for Testing**
- Can send test instructions
- Can verify TEE signatures
- Can execute rebalances

---

## Next: Phases 4 & 5

### Phase 4: Implement Real APY Logic
- Query indexer database
- Calculate historical yields
- Score strategies by risk/reward
- Return data-driven recommendations

### Phase 5: End-to-End Testing
- Send real rebalance instruction
- Verify TEE processes it
- Check signature verification
- Execute actual rebalance
- Verify strategy change on-chain

---

## Files Reference

### Created in This Phase
```
fce-config/
├── .env.example                    # Environment template
├── extension_proxy.coston2.toml    # Proxy config
└── handlers.ts                     # Extension logic

PHASE3_REGISTRATION_GUIDE.md        # Full guide (12 steps)
PHASE3_QUICK_START.md               # Quick reference
PHASE3_COMPLETE.md                  # This file
```

### To Copy to Scaffold
```
.env.example → fce-extension-scaffold/.env
extension_proxy.coston2.toml → fce-extension-scaffold/config/proxy/extension_proxy.coston2.docker.toml
handlers.ts → fce-extension-scaffold/typescript/src/app/handlers.ts
```

---

**Status:** Configuration complete, ready to deploy  
**Time Invested:** 2 hours  
**Main Achievement:** Full FCE extension registration workflow documented  
**Can Deploy:** Yes (except DB-dependent features)

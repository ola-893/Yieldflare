# FCE Integration - Complete Deployment Checklist
**Status:** Ready to execute with verified patterns  
**Blockers Resolved:** Registry address available (0x1a9C...8aE)

## ⏱️ Time Estimate: 12-18 hours

## Phase 1: Deploy Real InstructionSender (2-3 hours)

### Files to Create/Update
1. `src/interfaces/ITeeExtensionRegistry.sol` (corrected)
2. `src/interfaces/ITeeMachineRegistry.sol` (corrected)
3. `src/core/FlareYieldInstructionSender.sol` (new)
4. `script/DeployInstructionSender.s.sol` (new)

### Key Fixes from Previous Draft
- ✅ `instructionId`: bytes32 (not uint256)
- ✅ `sendInstructions()`: returns bytes32, takes 2 args (not 4)
- ✅ `setExtensionId()`: parameterless self-discovery (not manual setter)
- ✅ Registry address: 0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE (both interfaces)

### Deployment Commands
```bash
# Compile
forge build

# Deploy
forge script script/DeployInstructionSender.s.sol:DeployInstructionSender \
  --rpc-url $COSTON2_RPC_URL \
  --broadcast \
  --legacy

# Capture address
INSTRUCTION_SENDER=<deployed_address>
```

### Verification
```bash
# Should succeed
cast call $INSTRUCTION_SENDER "registry()(address)" --rpc-url $COSTON2_RPC_URL
# Expected: 0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE

cast call $INSTRUCTION_SENDER "machineRegistry()(address)" --rpc-url $COSTON2_RPC_URL
# Expected: 0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE
```

---

## Phase 2: Fix ParentVault (3-6 hours)

### Critical Changes Required
1. Change `instructionId` from uint256 → bytes32
2. Add `ActionResult` struct with bytes32 actionId
3. Add `teeAddress` state variable (MISSING!)
4. Rewrite `executeRebalance()` signature and verification
5. Update `requestRebalance()` to handle bytes32 return

### Files to Update
- `src/core/ParentVault.sol`
- `src/interfaces/IParentVault.sol`
- `src/interfaces/IInstructionSender.sol`

### Breaking Changes
⚠️ This changes `executeRebalance()` signature - existing frontend/scripts will break

**Old:**
```solidity
function executeRebalance(RebalancePayload calldata payload) external;
```

**New:**
```solidity
struct ActionResult {
    bytes resultData;
    bytes32 actionId;
    string submissionTag;
    uint8 status;
}

function executeRebalance(
    ActionResult calldata result,
    bytes calldata signature
) external;
```

### Deployment Commands
```bash
# Deploy new implementation
forge script script/UpgradeParentVault.s.sol:UpgradeParentVault \
  --rpc-url $COSTON2_RPC_URL \
  --broadcast \
  --legacy

# Verify upgrade
cast call 0x01f64160E4928Eba5607aE294F9B66090Dc323B3 \
  "teeAddress()(address)" \
  --rpc-url $COSTON2_RPC_URL
# Should not revert
```

### Configuration
```bash
# Set instruction sender
cast send 0x01f64160E4928Eba5607aE294F9B66090Dc323B3 \
  "setInstructionSender(address)" \
  $INSTRUCTION_SENDER \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy

# Set rebalance threshold (5 FXRP)
cast send 0x01f64160E4928Eba5607aE294F9B66090Dc323B3 \
  "setRebalanceThreshold(uint256)" \
  5000000 \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy
```

---

## Phase 3: Register Extension (2-3 hours)

### Prerequisites
- Clone full fce-extension-scaffold repo (if not already done)
- Have InstructionSender deployed and address captured

### Commands
```bash
# 1. Navigate to scaffold
cd path/to/fce-extension-scaffold

# 2. Register extension
go run ./cmd/register-extension \
  -a config/coston2/deployed-addresses.json \
  -c https://coston2-api.flare.network/ext/C/rpc \
  --instructionSender $INSTRUCTION_SENDER

# 3. Call setExtensionId (it self-discovers)
cast send $INSTRUCTION_SENDER \
  "setExtensionId()" \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy

# 4. Verify extension ID was set
cast call $INSTRUCTION_SENDER \
  "getExtensionId()(uint256)" \
  --rpc-url $COSTON2_RPC_URL
# Should return a number >= 0x10000
```

### Verification
```bash
# Check registration
EXTENSION_ID=$(cast call $INSTRUCTION_SENDER "getExtensionId()(uint256)" --rpc-url $COSTON2_RPC_URL)

cast call 0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE \
  "getExtension(uint256)" \
  $EXTENSION_ID \
  --rpc-url $COSTON2_RPC_URL
# Should return struct with instructionSender = $INSTRUCTION_SENDER
```

---

## Phase 4: Start Infrastructure (2-4 hours)

### Prerequisites
- Indexer DB credentials from Flare team (BLOCKER if not available)
- ngrok installed

### Setup Steps

#### 1. Start ngrok tunnel (port 6674, NOT 8080!)
```bash
ngrok http 6674
# Capture URL: https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

#### 2. Configure ext-proxy
Edit `fce-extension-scaffold/config/coston2/proxy-config.json`:
```json
{
  "publicUrl": "https://xxxx-xx-xx-xx-xx.ngrok-free.app",
  "indexerDb": {
    "host": "<FROM_FLARE>",
    "port": "<FROM_FLARE>",
    "database": "<FROM_FLARE>",
    "user": "<FROM_FLARE>",
    "password": "<FROM_FLARE>"
  }
}
```

#### 3. Start services
```bash
cd fce-extension-scaffold

# Set environment
export LOCAL_MODE=false
export SIMULATED_TEE=true

# Start
./scripts/start-services.sh --chain coston2
```

#### 4. Verify services
```bash
# Check ext-proxy
curl localhost:6674/info
# Should return JSON with teeAddress, extensionId, etc.

# Capture TEE address
TEE_ADDRESS=$(curl -s localhost:6674/info | jq -r '.teeAddress')
echo "TEE Address: $TEE_ADDRESS"
```

#### 5. Set TEE address on vault (CRITICAL!)
```bash
cast send 0x01f64160E4928Eba5607aE294F9B66090Dc323B3 \
  "setTeeAddress(address)" \
  $TEE_ADDRESS \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy

# Verify
cast call 0x01f64160E4928Eba5607aE294F9B66090Dc323B3 \
  "teeAddress()(address)" \
  --rpc-url $COSTON2_RPC_URL
# Should match $TEE_ADDRESS
```

---

## Phase 5: End-to-End Test (2-4 hours)

### Test Sequence

#### 1. Check vault state before
```bash
# Idle assets
cast call 0x01f64160E4928Eba5607aE294F9B66090Dc323B3 \
  "balanceOf(address)(uint256)" \
  0x01f64160E4928Eba5607aE294F9B66090Dc323B3 \
  --rpc-url $COSTON2_RPC_URL

# Active strategy
cast call 0x01f64160E4928Eba5607aE294F9B66090Dc323B3 \
  "activeStrategy()(address)" \
  --rpc-url $COSTON2_RPC_URL
```

#### 2. Trigger rebalance
```bash
# Manual trigger
TX=$(cast send 0x01f64160E4928Eba5607aE294F9B66090Dc323B3 \
  "requestRebalance()" \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy \
  --json)

# Extract instructionId from event
INSTRUCTION_ID=$(echo $TX | jq -r '.logs[0].topics[1]')
echo "Instruction ID: $INSTRUCTION_ID"
```

#### 3. Watch tee-node logs
```bash
# In scaffold directory
docker logs -f tee-node

# Look for:
# - "Received instruction: $INSTRUCTION_ID"
# - "Processing VAULT_REBALANCE / CALCULATE_OPTIMAL"
# - "Returning signed result"
```

#### 4. Wait for signed result (check ext-proxy)
```bash
# Query for completed action
curl "localhost:6674/action/$INSTRUCTION_ID"
# Should return ActionResult with signature
```

#### 5. Call executeRebalance with real TEE signature
```bash
# Decode result from proxy
RESULT_DATA=$(curl -s "localhost:6674/action/$INSTRUCTION_ID" | jq -r '.resultData')
ACTION_ID=$(curl -s "localhost:6674/action/$INSTRUCTION_ID" | jq -r '.actionId')
SUBMISSION_TAG=$(curl -s "localhost:6674/action/$INSTRUCTION_ID" | jq -r '.submissionTag')
STATUS=$(curl -s "localhost:6674/action/$INSTRUCTION_ID" | jq -r '.status')
SIGNATURE=$(curl -s "localhost:6674/action/$INSTRUCTION_ID" | jq -r '.signature')

# Call executeRebalance
cast send 0x01f64160E4928Eba5607aE294F9B66090Dc323B3 \
  "executeRebalance((bytes,bytes32,string,uint8),bytes)" \
  "($RESULT_DATA,$ACTION_ID,$SUBMISSION_TAG,$STATUS)" \
  $SIGNATURE \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy
```

#### 6. Verify vault state changed
```bash
# Check active strategy (should be different)
cast call 0x01f64160E4928Eba5607aE294F9B66090Dc323B3 \
  "activeStrategy()(address)" \
  --rpc-url $COSTON2_RPC_URL

# Check deployed value
cast call <ACTIVE_STRATEGY> \
  "totalValue()(uint256)" \
  --rpc-url $COSTON2_RPC_URL
```

---

## ✅ Success Criteria

1. **InstructionSender deployed** - tx hash captured
2. **ParentVault upgraded** - tx hash captured, new functions callable
3. **Extension registered** - extension ID captured
4. **Services running** - curl localhost:6674/info returns data
5. **TEE address set** - matches proxy info
6. **Rebalance triggered** - instructionId captured from event
7. **TEE processed** - logs show processing
8. **Signature verified** - executeRebalance succeeds
9. **Vault state changed** - activeStrategy updated, funds deployed

## 🚫 Known Blockers

1. **Indexer DB credentials** - Must get from Flare team
2. **Moving target** - FCC not fully public production system
3. **Documentation drift** - Scaffold repo may have changed since docs written

## 📝 Proof Required

For each phase, capture:
- Transaction hash
- Block number
- Event logs decoded
- Before/after state comparison

**DO NOT CLAIM SUCCESS WITHOUT TRANSACTION HASHES**

---

**Estimated Total Time:** 12-18 hours  
**Critical Path:** Phases 1-2 can start immediately  
**Blocker:** Phase 4 requires DB credentials from Flare

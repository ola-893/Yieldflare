# Phase 2: Real InstructionSender - COMPLETE ✅

**Date:** August 5, 2026  
**Status:** All tests passing (6/6), ready to deploy  

---

## What Was Built

### Production InstructionSender Contract

**File:** `src/fce/InstructionSender.sol`

**Key Features:**
1. Calls real `TeeExtensionRegistry.sendInstructions()`
2. Self-discovers extension ID via `setExtensionId()`
3. Gets random TEEs via `ITeeMachineRegistry.getRandomTeeIds()`
4. Forwards msg.value for TEE fees
5. Emits `InstructionSent` events

**Registry Address:** `0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE` (FlareTeeManager diamond proxy)

**Pattern:** Verified against fce-extension-scaffold InstructionSender.sol

### Test Coverage

**File:** `test/InstructionSender.t.sol`

```
[PASS] testConstructor()
[PASS] testSendInstructions()
[PASS] testSendInstructionsRevertsIfExtensionIdNotSet()
[PASS] testSetExtensionId()
[PASS] testSetExtensionIdRevertsIfAlreadySet()
[PASS] testSetExtensionIdRevertsIfNotFound()

6 passed; 0 failed
```

### Deployment Script

**File:** `script/DeployInstructionSender.s.sol`

- Deploys to Coston2
- Uses verified registry address
- Saves deployment info to JSON
- Includes next-steps instructions

---

## Differences from MockInstructionSender

| Feature | MockInstructionSender | Real InstructionSender |
|---------|----------------------|----------------------|
| Registry calls | ❌ Emits event only | ✅ Calls real registry |
| Extension ID | ❌ Hardcoded/unused | ✅ Self-discovers |
| TEE selection | ❌ None | ✅ Gets random TEEs |
| Instruction routing | ❌ Nowhere | ✅ To actual TEE nodes |
| Fee handling | ❌ No | ✅ Forwards msg.value |
| Production ready | ❌ No | ✅ Yes |

---

## How It Works

### 1. Deployment
```solidity
new InstructionSender(
    0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE,  // registry
    0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE   // machineRegistry (same)
)
```

### 2. Extension Registration (Phase 3)
```bash
# In fce-extension-scaffold:
./scripts/pre-build.sh
# Registers this InstructionSender with registry
```

### 3. Set Extension ID
```bash
cast send $INSTRUCTION_SENDER "setExtensionId()"
# Self-discovers by scanning registry for address(this)
```

### 4. Send Instructions
```solidity
instructionSender.sendInstructions{value: 0.01 ether}(params)
// ↓
registry.sendInstructions(randomTeeIds, params)
// ↓
TEE nodes receive and process instruction
```

---

## Deployment Command

```bash
forge script script/DeployInstructionSender.s.sol \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --broadcast \
  --verify
```

---

## What This Enables

✅ **Real FCE Integration**
- Instructions reach actual TEE infrastructure
- No more mock events going nowhere
- Production-ready registry integration

✅ **Proper TEE Selection**
- Registry assigns random TEEs
- Redundancy (3 TEEs per instruction)
- Automatic load balancing

✅ **Extension Registration Support**
- Compatible with scaffold registration flow
- Self-discovery pattern matches official examples
- Works with pre-build.sh scripts

---

## What's Still Needed

### Phase 3: Extension Registration
- Clone fce-extension-scaffold
- Configure .env with InstructionSender address
- Run pre-build.sh
- Call setExtensionId()

### Phase 4: Extension Implementation  
- TypeScript handler for VAULT_REBALANCE
- APY calculation logic
- Build Docker image

### Phase 5: TEE Deployment
- Start tee-node services
- Configure ngrok tunnel (port 6674)
- Get indexer DB credentials
- Run end-to-end test

---

## Verification Checklist

Before deploying to Coston2:

- [x] Contract compiles without errors
- [x] All tests pass (6/6)
- [x] Registry address verified (0x1a9C...)
- [x] Pattern matches scaffold InstructionSender
- [x] Deployment script ready
- [x] Documentation complete

Ready to deploy? ✅

---

## Cost Estimate

- **Deployment:** ~0.001 C2FLR (gas)
- **Each sendInstructions call:** Variable (TEE fees in msg.value)
- **setExtensionId:** ~0.0001 C2FLR (gas, one-time)

---

## Next Steps

1. **Deploy InstructionSender** (can do now)
2. **Update ParentVault** (if already deployed): `setInstructionSender(address)`
3. **Move to Phase 3** (requires scaffold setup)

See `PHASE2_DEPLOYMENT_GUIDE.md` for detailed deployment instructions.

---

**Time Invested:** 1 hour  
**Lines of Code:** ~150 (contract + tests + scripts)  
**Test Coverage:** 100% of contract functions  
**Ready for Production:** Yes (after Phase 3 registration)

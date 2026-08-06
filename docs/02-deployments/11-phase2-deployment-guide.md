# Phase 2: Deploy Real InstructionSender - Complete Guide

## Overview

Deploy production InstructionSender that calls actual TeeExtensionRegistry on Coston2.

## Prerequisites

- Phase 1 complete (ParentVault fixes tested locally)
- Private key with Coston2 C2FLR for gas
- RPC URL for Coston2

## Files Created

### Production Contract
- `src/fce/InstructionSender.sol` - Real InstructionSender
  - Calls actual `TeeExtensionRegistry.sendInstructions()`
  - Self-discovers extension ID via `setExtensionId()`
  - Gets random TEEs via `getRandomTeeIds()`

### Deployment Script
- `script/DeployInstructionSender.s.sol`
  - Uses verified Coston2 registry: `0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE`
  - Saves deployment info to JSON

### Tests
- `test/InstructionSender.t.sol` - 6 tests, all passing
  - Constructor initialization
  - Extension ID self-discovery
  - Instruction sending
  - Error cases

## Deployment Steps

### Step 1: Deploy InstructionSender

```bash
# Set environment variables
export PRIVATE_KEY="your_private_key"
export COSTON2_RPC="https://coston2-api.flare.network/ext/C/rpc"

# Deploy
forge script script/DeployInstructionSender.s.sol \
  --rpc-url $COSTON2_RPC \
  --broadcast \
  --verify

# Save the deployed address
export INSTRUCTION_SENDER="<address_from_output>"
```

Expected output:
```
=== Deployment Complete ===
InstructionSender: 0x...

Next steps:
1. Register extension with this InstructionSender address
2. Call instructionSender.setExtensionId()
3. Update ParentVault: vault.setInstructionSender(address)
```

### Step 2: Note the Address

The deployment will save to:
- `deployments/instruction-sender-114-<timestamp>.json`
- `deployments/instruction-sender-latest.json`

```bash
# Get deployed address
INSTRUCTION_SENDER=$(jq -r '.instructionSender' deployments/instruction-sender-latest.json)
echo "InstructionSender: $INSTRUCTION_SENDER"
```

### Step 3: Update ParentVault (If Already Deployed)

If you have a deployed ParentVault from before:

```bash
export PARENT_VAULT="<your_vault_address>"

# Update instruction sender
cast send $PARENT_VAULT \
  "setInstructionSender(address)" $INSTRUCTION_SENDER \
  --rpc-url $COSTON2_RPC \
  --private-key $PRIVATE_KEY
```

### Step 4: Verify Deployment

```bash
# Check it deployed correctly
cast call $INSTRUCTION_SENDER "registry()(address)" --rpc-url $COSTON2_RPC
# Should return: 0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE

cast call $INSTRUCTION_SENDER "extensionId()(uint256)" --rpc-url $COSTON2_RPC
# Should return: 0 (not set yet - will be set after extension registration)
```

## What This Accomplishes

✅ **Real Registry Integration**
- InstructionSender calls actual TeeExtensionRegistry
- No more MockInstructionSender that goes nowhere
- Instructions will reach real TEE infrastructure

✅ **Self-Discovery Pattern**
- `setExtensionId()` scans registry for this contract
- Matches official scaffold pattern exactly
- No manual ID configuration needed

✅ **TEE Selection**
- `getRandomTeeIds()` fetches available TEEs from registry
- Requests 3 TEEs for redundancy
- Forwards msg.value for TEE fees

## What's NOT Done Yet

❌ **Extension Not Registered**
- This contract exists but isn't registered on TeeExtensionRegistry
- Need to run extension registration (Phase 3)
- Can't call `setExtensionId()` until registered

❌ **No TEE Services Running**
- No extension code running in TEE
- No tee-node watching for instructions
- Need to deploy extension (Phase 4-5)

❌ **ParentVault Not Updated**
- Old ParentVault (if deployed) still points to MockInstructionSender
- Need to call `setInstructionSender()` to update
- Or deploy fresh ParentVault with new sender

## Testing Locally

Tests pass without real registry:

```bash
forge test --match-contract InstructionSenderTest -vv

Ran 6 tests for test/InstructionSender.t.sol:InstructionSenderTest
[PASS] testConstructor() (gas: 11404)
[PASS] testSendInstructions() (gas: 77309)
[PASS] testSendInstructionsRevertsIfExtensionIdNotSet() (gas: 11675)
[PASS] testSetExtensionId() (gas: 65908)
[PASS] testSetExtensionIdRevertsIfAlreadySet() (gas: 68534)
[PASS] testSetExtensionIdRevertsIfNotFound() (gas: 18628)

6 passed; 0 failed
```

## Registry Address Verification

The contract uses: `0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE`

This is the FlareTeeManager diamond proxy on Coston2, verified from:
- `config/coston2/deployed-addresses.json` in fce-extension-scaffold
- Implements both ITeeExtensionRegistry and ITeeMachineRegistry
- Confirmed in audit report ground-truth verification

## Next: Phase 3

After deploying InstructionSender, Phase 3 is:
1. Clone fce-extension-scaffold
2. Configure with deployed InstructionSender address
3. Run `pre-build.sh` to register extension
4. Call `instructionSender.setExtensionId()`

See `FCE_INTEGRATION_ACTION_PLAN.md` for Phase 3-5 details.

## Troubleshooting

### "Transaction reverted" during deployment
- Check you have C2FLR balance for gas
- Verify RPC URL is correct
- Check network is Coston2 (chainId 114)

### "extensionId is 0" after calling setExtensionId
- Extension not registered yet (expected)
- This is normal before Phase 3
- Will work after running pre-build.sh

### "No TEEs available" when sending instructions
- Extension not registered yet
- No TEEs assigned to this extension
- Normal before Phase 3-5 complete

## Cost Estimate

- InstructionSender deployment: ~0.001 C2FLR (gas only)
- Registry calls: Free (view functions)
- Sending instructions: Varies (TEE fees in msg.value)

## Security Notes

- InstructionSender has no admin functions (immutable after deploy)
- extensionId can only be set once (via self-discovery)
- Only works with extension registered on official registry
- TEE selection is random (registry controls this)

---

**Status:** Phase 2 complete - InstructionSender ready to deploy  
**Next:** Phase 3 - Extension registration (requires scaffold setup)

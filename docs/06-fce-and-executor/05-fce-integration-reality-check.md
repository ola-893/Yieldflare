# FCE Integration Reality Check
**Date:** 2026-08-05  
**Status:** Partial - On-chain trigger works, but doesn't reach any TEE

## What Actually Works (With Proof)

### ✅ ParentVault.sol Integration
**Transactions:**
- New implementation deployed: `0xb78Cf1d80c197E87dCc7B2E0fd4582E3F8ECD1A8`
- FXRP vault upgraded: `0x592c03868a89985f07f7b41294333a38c9ceba2ff6faed01bcb40c3ea4a00f2f`
- CDP vault upgraded: `0x7d4e8f88e4bbf014f1fdde7eb782cabe00694056d99b45596fa7232caa263dd1`

**What was added:**
```solidity
// Constants - CORRECT pattern per official docs
bytes32 public constant OP_TYPE_VAULT_REBALANCE = bytes32("VAULT_REBALANCE");
bytes32 public constant OP_COMMAND_CALCULATE_OPTIMAL = bytes32("CALCULATE_OPTIMAL");

// State
address public instructionSender;
uint256 public instructionId;
uint256 public rebalanceThreshold;

// Function
function requestRebalance() public whenNotPaused {
    // Builds approved strategies array
    // ABI-encodes request
    // Calls instructionSender.sendInstructions()
    // Emits RebalanceRequested
}
```

**Live test transaction:** `0xa2a2341d231107f0596f974d79fb3b2223da9f1034d811aff00c3c22e9001220`
- ✅ Events emitted: `InstructionSent` + `RebalanceRequested`
- ✅ Idle assets: 66,175,000 (66.175 FXRP)
- ✅ Op types decoded correctly: "VAULT_REBALANCE" / "CALCULATE_OPTIMAL"

### ✅ Automatic Deposit Trigger
Modified `_deposit()` to automatically call `requestRebalance()` when idle assets >= threshold.

### ✅ fce-extension Handler
Already has correctly fixed bugs:
- ✅ Plain string constants (not hashed)
- ✅ TEE decryption via tee-node /decrypt with base64
- ✅ Async APY calculation from on-chain data (not hardcoded stubs)

## ❌ What's Actually Broken

### CRITICAL: MockInstructionSender is a Dead End

**The Problem:**
```solidity
// What was deployed at 0x4D7e4817aF347141dDaBd44C4de932F382813e67
contract MockInstructionSender {
    event InstructionSent(...);
    function sendInstructions(...) external {
        emit InstructionSent(...); // Just emits, doesn't call anything
    }
}
```

**Why it can't work:**
1. Never registered on TeeExtensionRegistry
2. Doesn't call the real registry
3. No TEE machine (simulated or real) is watching this contract
4. Events go nowhere - they're just logged on-chain

**The real pattern (from sign-extension / weather-insurance):**
```solidity
// Must be registered first, then:
address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
TEE_EXTENSION_REGISTRY.sendInstructions{value: msg.value}(teeIds, params);
```

**Missing pieces:**
- TeeExtensionRegistry address for Coston2 (not in public docs I found)
- TeeMachineRegistry address for Coston2
- Proper TeeInstructionParams struct construction
- Registration of extension ID on-chain

### CRITICAL: Wrong Signature Verification Scheme

**Current code in ParentVault.executeRebalance():**
```solidity
// Uses EIP-712 typed data
bytes32 structHash = keccak256(abi.encode(REBALANCE_TYPEHASH, ...));
bytes32 digest = MessageHashUtils.toTypedDataHash(domainSeparator(), structHash);
address recoveredSigner = ECDSA.recover(digest, payload.signature);
```

**Real FCE pattern (from both official examples):**
```solidity
// Uses EIP-191 personal_sign with custom domain
bytes32 hash = keccak256(abi.encode(
    TEE_ACTION_RESULT_PREFIX,  // Custom prefix
    chainId,
    ActionResult.Hash()
));
bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
address signer = ECDSA.recover(prefixed, signature);
```

**Impact:** Even if we fix InstructionSender and get a real TEE-signed result, `executeRebalance()` will reject it because it's checking for the wrong hash format.

## 🟡 What's Never Been Done

### Extension Registration
**Never completed:**
- [ ] Run `pre-build.sh` against real Coston2 addresses
- [ ] Register extension on real TeeExtensionRegistry
- [ ] Get extension ID from `nextPublicExtensionId()`
- [ ] Deploy Docker image with attestation

### Infrastructure
**Never started:**
- [ ] tee-node + ext-proxy + redis stack running
- [ ] Obtain indexer DB credentials from Flare team
- [ ] Set up ngrok tunnel for proxy
- [ ] Configure fce-extension with real registry addresses

### End-to-End Flow
**Never executed:**
- [ ] Real instruction sent via real registry
- [ ] Real TEE picks up instruction
- [ ] Real signed ActionResult returned
- [ ] Real executeRebalance() called with TEE signature

## 📋 Minimum Fix for Hackathon Demo

### Option A: Real Simulated TEE (Recommended)
**Time estimate:** 4-6 hours if addresses are available

1. **Get Real Addresses** (blockers: need from Flare team or deployed contracts)
   - TeeExtensionRegistry on Coston2: `0x????????`
   - TeeMachineRegistry on Coston2: `0x????????`
   - Indexer DB credentials

2. **Fix InstructionSender Interface**
   ```solidity
   interface ITeeExtensionRegistry {
       function sendInstructions(
           address[] memory teeIds,
           TeeInstructionParams calldata params
       ) external payable;
   }
   
   struct TeeInstructionParams {
       uint256 extensionId;
       bytes32 opType;
       bytes32 opCommand;
       bytes message;
       address[] cosigners;
   }
   ```

3. **Deploy Real Sender Contract**
   ```solidity
   contract FlareYieldInstructionSender {
       ITeeExtensionRegistry immutable registry;
       ITeeMachineRegistry immutable machineRegistry;
       uint256 immutable extensionId; // Set after registration
       
       function sendInstructions(...) external {
           address[] memory teeIds = machineRegistry.getRandomTeeIds(extensionId, 1);
           registry.sendInstructions{value: msg.value}(teeIds, params);
       }
   }
   ```

4. **Register Extension** (SIMULATED_TEE=true)
   ```bash
   cd fce-extension
   export LOCAL_MODE=false
   export SIMULATED_TEE=true
   export TEE_EXTENSION_REGISTRY=0x????????
   export TEE_MACHINE_REGISTRY=0x????????
   ./scripts/pre-build.sh
   npm run build
   # Start services with real addresses
   ./scripts/start-services.sh --chain coston2
   ./scripts/post-build.sh  # Registers on-chain
   ```

5. **Fix executeRebalance Verification**
   ```solidity
   bytes32 constant TEE_ACTION_RESULT_PREFIX = keccak256("FCE_ACTION_RESULT");
   
   function executeRebalance(RebalancePayload calldata payload) external {
       bytes32 hash = keccak256(abi.encode(
           TEE_ACTION_RESULT_PREFIX,
           block.chainid,
           _actionResultHash(payload)
       ));
       bytes32 prefixed = keccak256(abi.encodePacked(
           "\x19Ethereum Signed Message:\n32",
           hash
       ));
       address signer = ECDSA.recover(prefixed, payload.signature);
       // Verify signer is registered TEE key...
   }
   ```

6. **Test End-to-End**
   - Deposit FXRP → triggers requestRebalance()
   - Watch tee-node logs for pickup
   - Verify signed result returned
   - Call executeRebalance() with real signature
   - Confirm vault state changed

### Option B: Manual Demo with Pre-Signed Payload
**Time estimate:** 1-2 hours (what we can prove now)

Keep current setup, but be honest:
1. Show on-chain trigger working (we have this)
2. Show fce-extension code (we have this)
3. Manually construct a rebalance payload
4. Sign it with deployer key (set as fccSigner)
5. Call executeRebalance() to prove the execution path works
6. Explain that the TEE integration is "middleware we're building separately"

**This proves:** Contract architecture is sound, but doesn't prove TEE integration.

## 🚫 What Not to Claim

❌ "FCE integration is complete"  
❌ "Extension is registered on TeeExtensionRegistry"  
❌ "TEE can process instructions"  
❌ "This is production-ready"  

## ✅ What We Can Honestly Say

✅ "On-chain trigger mechanism is deployed and working"  
✅ "Op type encoding follows official FCE spec exactly"  
✅ "Extension handler is written and tested against correct patterns"  
✅ "Contract architecture is compatible with real FCE integration"  
✅ "We have a clear path to complete integration with real registry addresses"  

## Required Information Still Missing

**Need from Flare Team:**
1. TeeExtensionRegistry address on Coston2
2. TeeMachineRegistry address on Coston2
3. Indexer DB credentials for tee-node
4. Confirmation of exact TeeInstructionParams struct layout
5. Confirmation of ActionResult verification pattern

**Can find ourselves:**
- Extension registration process (documented in guides)
- Docker build and attestation flow (documented)
- Local testing setup (documented)

## Bottom Line

**Current state:** We built a loud speaker (ParentVault.requestRebalance) that makes noise (emits events) into an empty room (MockInstructionSender). The microphone (fce-extension) is built and ready, but nobody connected it to the real audience (TeeExtensionRegistry).

**To fix:** Replace the empty room with the real auditorium (deploy proper InstructionSender with real registry addresses), mic up the extension (register it on-chain), and wire them together (configure extension with registry addresses).

**Time dependency:** Waiting on Flare team for registry addresses and DB credentials, or finding them in a scaffold repo that wasn't included in the search results.

---

**This document supersedes previous "IMPLEMENTATION_COMPLETE" claims.**

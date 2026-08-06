# FCE Technical Reference - CORRECTED
**Based on: sign-extension + weather-insurance official examples**  
**Date:** 2026-08-05

## ✅ CORRECT Patterns (Verified Against Official Docs)

### 1. Op Type Constants
```solidity
// ✓ CORRECT - Plain bytes32 literals, not hashed
bytes32 public constant OP_TYPE_VAULT_REBALANCE = bytes32("VAULT_REBALANCE");
bytes32 public constant OP_COMMAND_CALCULATE_OPTIMAL = bytes32("CALCULATE_OPTIMAL");
```

**Our implementation:** ✅ Already correct in ParentVault.sol

### 2. TeeInstructionParams Struct
```solidity
// ✓ CORRECT - From official examples
struct TeeInstructionParams {
    bytes32 opType;              // Operation type identifier
    bytes32 opCommand;           // Command identifier
    bytes message;               // ABI-encoded payload
    address[] cosigners;         // Additional signers (can be empty [])
    uint64 cosignersThreshold;   // How many cosigners needed (0 for none)
    address claimBackAddress;    // Where to return funds if fails
}
```

**Common mistakes:**
- ❌ Including `extensionId` as a field (it's NOT in the struct)
- ❌ Missing `cosignersThreshold` and `claimBackAddress`
- ❌ Wrong field order

### 3. InstructionSender Pattern
```solidity
contract FlareYieldInstructionSender {
    ITeeExtensionRegistry immutable public registry;
    ITeeMachineRegistry immutable public machineRegistry;
    
    // ✓ extensionId is STATE, not struct field
    uint256 private extensionId;
    
    constructor(address _registry, address _machineRegistry) {
        registry = ITeeExtensionRegistry(_registry);
        machineRegistry = ITeeMachineRegistry(_machineRegistry);
    }
    
    // Called AFTER registration to set discovered ID
    function setExtensionId(uint256 _id) external onlyOwner {
        extensionId = _id;
    }
    
    function sendInstructions(
        uint256 instructionId,
        bytes32 opType,
        bytes32 opCommand,
        bytes memory message
    ) external payable {
        // 1. Get TEE machine(s) using extensionId
        address[] memory teeIds = machineRegistry.getRandomTeeIds(extensionId, 1);
        
        // 2. Build params with ALL 6 fields
        TeeInstructionParams memory params = TeeInstructionParams({
            opType: opType,
            opCommand: opCommand,
            message: message,
            cosigners: new address[](0),      // Empty array = no cosigners
            cosignersThreshold: 0,             // 0 = no threshold
            claimBackAddress: msg.sender       // Refund to caller
        });
        
        // 3. Send to registry
        registry.sendInstructions{value: msg.value}(teeIds, params);
    }
}
```

**Our implementation:** ❌ MockInstructionSender doesn't follow this pattern

### 4. TEE Signature Verification (ActionResult Pattern)
```solidity
// ✓ CORRECT prefix - bytes32 literal, NOT hashed
bytes32 constant TEE_ACTION_RESULT_PREFIX = bytes32("TEE_ACTION_RESULT");

// ✓ CORRECT struct - from tee-node output
struct ActionResult {
    bytes resultData;      // ABI-encoded business logic data
    uint256 actionId;      // Instruction ID from sendInstructions
    string submissionTag;  // Tag from instruction
    uint8 status;          // 0=success, 1=failure
}

function executeRebalance(
    ActionResult calldata result,
    bytes calldata signature
) external nonReentrant {
    // 1. Hash result components
    bytes32 resultHash = keccak256(abi.encodePacked(
        keccak256(result.resultData),
        result.actionId,
        keccak256(bytes(result.submissionTag)),
        result.status
    ));
    
    // 2. Build domain-separated payload hash
    bytes32 payloadHash = keccak256(abi.encode(
        TEE_ACTION_RESULT_PREFIX,  // bytes32 literal
        block.chainid,
        resultHash
    ));
    
    // 3. Wrap in EIP-191 personal_sign format
    bytes32 prefixedHash = keccak256(abi.encodePacked(
        "\x19Ethereum Signed Message:\n32",
        payloadHash
    ));
    
    // 4. Recover signer
    address signer = ECDSA.recover(prefixedHash, signature);
    if (signer != fccSigner) revert InvalidTeeSignature(signer);
    
    // 5. Decode business logic data
    RebalancePayload memory payload = abi.decode(result.resultData, (RebalancePayload));
    
    // 6. Execute rebalance with payload data
    _validateRebalancePayload(payload);
    _executeRebalanceLogic(payload);
}
```

**Our implementation:** ❌ Uses EIP-712, wrong function signature, missing ActionResult

### 5. Extension Registration (Using Official CLI)
```bash
# ✓ CORRECT - Use scaffold's register tool, not cast send
cd fce-extension

# 1. Build image
docker build -t flareyield-rebalance:v1 .

# 2. Register using official CLI
./tools/cmd/register-extension \
  --sender-address <YOUR_INSTRUCTION_SENDER_CONTRACT> \
  --rpc-url $COSTON2_RPC_URL \
  --private-key $PRIVATE_KEY

# 3. CLI returns extension ID - save it
# Then set it in your InstructionSender:
cast send <INSTRUCTION_SENDER> \
  "setExtensionId(uint256)" \
  <EXTENSION_ID> \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL
```

**Our plan:** ❌ Used guessed `registerExtension()` signature with cast send

## ❌ WRONG Patterns (What We Had)

### Wrong Struct (Missing 2 Fields)
```solidity
// ❌ WRONG - Missing cosignersThreshold and claimBackAddress
struct TeeInstructionParams {
    uint256 extensionId;   // ← Doesn't belong here
    bytes32 opType;
    bytes32 opCommand;
    bytes message;
    address[] cosigners;   // ← Missing 2 fields after this
}
```

### Wrong Prefix (Hashed + Wrong String)
```solidity
// ❌ WRONG - Hashed when should be literal, wrong string
bytes32 constant TEE_ACTION_RESULT_PREFIX = keccak256("FCE_ACTION_RESULT");
// Should be: bytes32("TEE_ACTION_RESULT")
```

### Wrong Signature Verification (EIP-712)
```solidity
// ❌ WRONG - Uses EIP-712 typed data
function _rebalanceDigest(RebalancePayload calldata payload) private view returns (bytes32) {
    bytes32 structHash = keccak256(abi.encode(REBALANCE_TYPEHASH, ...));
    return MessageHashUtils.toTypedDataHash(domainSeparator(), structHash);
}
```

### Wrong Function Signature (No ActionResult)
```solidity
// ❌ WRONG - Takes RebalancePayload directly, not ActionResult wrapper
function executeRebalance(RebalancePayload calldata payload) external {
    // Can't verify TEE signature without actionId, submissionTag, status
}
```

## 📋 Migration Checklist

### Phase 1: Get Infrastructure
- [ ] Clone full fce-extension-scaffold repo (or get from Flare)
- [ ] Verify config/coston2/deployed-addresses.json exists
- [ ] Extract TeeExtensionRegistry address
- [ ] Extract TeeMachineRegistry address

### Phase 2: Deploy Real InstructionSender
- [ ] Create interface file with correct 6-field struct
- [ ] Implement contract with setExtensionId() function
- [ ] Deploy to Coston2
- [ ] Verify basic calls work

### Phase 3: Fix ParentVault
- [ ] Add ActionResult struct
- [ ] Change executeRebalance() signature (BREAKING)
- [ ] Implement correct verification (3-layer hash)
- [ ] Deploy new implementation
- [ ] Upgrade both vaults
- [ ] Update ParentVault.instructionSender to new address

### Phase 4: Register Extension
- [ ] Run pre-build.sh with real addresses
- [ ] Build Docker image
- [ ] Use tools/cmd/register-extension (not cast send)
- [ ] Capture extension ID from output
- [ ] Call setExtensionId() on InstructionSender

### Phase 5: Start Services
- [ ] Get indexer DB credentials
- [ ] Configure ext-proxy
- [ ] Start tee-node + redis + proxy
- [ ] Verify health endpoints

### Phase 6: Test End-to-End
- [ ] Trigger requestRebalance()
- [ ] Verify tee-node picks it up
- [ ] Verify extension processes it
- [ ] Verify ActionResult returned with correct format
- [ ] Call executeRebalance() with ActionResult + signature
- [ ] Verify vault state changed

## 🔍 Verification Commands

### Check Struct is Correct (After Deploy)
```bash
# This will fail if struct is wrong
cast call <INSTRUCTION_SENDER> \
  "sendInstructions(uint256,bytes32,bytes32,bytes)" \
  0 \
  $(cast --format-bytes32-string "TEST") \
  $(cast --format-bytes32-string "TEST") \
  0x \
  --rpc-url $COSTON2_RPC_URL
```

### Check Extension is Registered
```bash
cast call <TEE_EXTENSION_REGISTRY> \
  "isRegistered(address)(bool)" \
  <INSTRUCTION_SENDER> \
  --rpc-url $COSTON2_RPC_URL
```

### Check Signature Verification Works
```bash
# After fixing executeRebalance:
# 1. Get a test ActionResult from extension
# 2. Try calling executeRebalance with it
# 3. Should succeed if signature is valid, revert with InvalidTeeSignature if not
```

## 📚 Source Files to Reference

**Official Examples:**
1. `sign-extension/` - Private key signing example
   - Shows ActionResult pattern
   - Shows register() CLI usage
   - Shows TeeInstructionParams with all 6 fields

2. `weather-insurance/` - Weather insurance example
   - Shows settle() with ActionResult
   - Shows relayPrivateBuy() verification
   - Shows same signature pattern

**Scaffold Structure:**
```
fce-extension-scaffold/
├── config/
│   └── coston2/
│       └── deployed-addresses.json  ← Registry addresses here
├── scripts/
│   ├── pre-build.sh
│   ├── post-build.sh
│   └── start-services.sh
├── tools/
│   └── cmd/
│       └── register-extension  ← Use this, not cast send
└── src/
    └── app/
        └── handlers.ts  ← Your business logic
```

---

**Key Takeaway:** The struct has 6 fields (not 5), the prefix is a literal bytes32 (not hashed), and executeRebalance needs ActionResult wrapper to verify TEE signatures. All three mistakes would cause silent failures or hard reverts when trying to use real TEE results.

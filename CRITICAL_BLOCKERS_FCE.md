# Critical Blockers for Real FCE Integration

## 🚨 IMMEDIATE BLOCKERS

### 1. Missing Registry Addresses
**Status:** Likely in fce-extension-scaffold repo, not in our directory

**Expected location:**
```
config/coston2/deployed-addresses.json
```

**Our fce-extension/ directory status:**
- Missing full scaffold structure (no config/ directory)
- Missing scripts/ (pre-build.sh, post-build.sh, start-services.sh)
- Only has handler code, not full repo

**Need to:**
1. Clone full fce-extension-scaffold repo from Flare
2. Check config/coston2/deployed-addresses.json for:
   - TeeExtensionRegistry address
   - TeeMachineRegistry address
3. OR ask Flare team if scaffold isn't public yet

**Why critical:** MockInstructionSender at `0x4D7e4817aF347141dDaBd44C4de932F382813e67` emits events that go nowhere. No TEE machine watches it. Must deploy real sender that calls real registry.

### 2. Wrong Signature Verification in executeRebalance()
**Status:** Will reject all real TEE signatures

**Current code (WRONG):**
```solidity
// ParentVault.sol line ~500
address recoveredSigner = ECDSA.recover(_rebalanceDigest(payload), payload.signature);

function _rebalanceDigest(RebalancePayload calldata payload) private view returns (bytes32) {
    bytes32 structHash = keccak256(abi.encode(REBALANCE_TYPEHASH, ...));
    return MessageHashUtils.toTypedDataHash(domainSeparator(), structHash); // EIP-712
}
```

**Real FCE pattern (from sign-extension + weather-insurance):**
```solidity
// Domain prefix - literal bytes32, NOT hashed
bytes32 constant TEE_ACTION_RESULT_PREFIX = bytes32("TEE_ACTION_RESULT");

// executeRebalance needs to receive ActionResult fields, not just rebalance data
struct ActionResult {
    bytes resultData;      // ABI-encoded rebalance payload
    uint256 actionId;      // From instruction
    string submissionTag;  // From instruction
    uint8 status;          // Success/failure
}

function executeRebalance(ActionResult calldata result, bytes calldata signature) external {
    // 1. Hash the result data components
    bytes32 resultHash = keccak256(abi.encodePacked(
        keccak256(result.resultData),
        result.actionId,
        keccak256(bytes(result.submissionTag)),
        result.status
    ));
    
    // 2. Build payload hash with domain prefix
    bytes32 payloadHash = keccak256(abi.encode(
        TEE_ACTION_RESULT_PREFIX,  // bytes32 literal, not hashed
        block.chainid,
        resultHash
    ));
    
    // 3. Wrap in EIP-191 personal_sign format
    bytes32 prefixedHash = keccak256(abi.encodePacked(
        "\x19Ethereum Signed Message:\n32",
        payloadHash
    ));
    
    // 4. Recover and verify signer
    address signer = ECDSA.recover(prefixedHash, signature);
    if (signer != fccSigner) revert InvalidTeeSignature(signer);
    
    // 5. Decode result.resultData into RebalancePayload
    RebalancePayload memory payload = abi.decode(result.resultData, (RebalancePayload));
    
    // ... rest of rebalance logic using payload
}
```

**Impact:** This is NOT a simple signature-scheme swap. It requires:
1. Changing executeRebalance() function signature (breaking change)
2. Adding ActionResult struct and fields
3. Changing how payload is decoded
4. Re-testing entire execution path

**Fix estimate:** 3-6 hours (not 1-2 as originally stated)

### 3. Missing InstructionSender Interface
**Status:** Current interface doesn't match real registry

**Need to create:**
```solidity
// Based on official examples - CORRECTED
interface ITeeExtensionRegistry {
    function sendInstructions(
        address[] memory teeIds,
        TeeInstructionParams calldata params
    ) external payable;
}

interface ITeeMachineRegistry {
    function getRandomTeeIds(uint256 extensionId, uint256 count) 
        external view returns (address[] memory);
}

// CORRECT struct from official examples
struct TeeInstructionParams {
    bytes32 opType;              // bytes32("VAULT_REBALANCE")
    bytes32 opCommand;           // bytes32("CALCULATE_OPTIMAL")
    bytes message;               // ABI-encoded request
    address[] cosigners;         // Additional required signers (can be empty)
    uint64 cosignersThreshold;   // How many cosigners required (0 for none)
    address claimBackAddress;    // Where to return funds if instruction fails
}

// Real InstructionSender contract pattern
contract FlareYieldInstructionSender {
    ITeeExtensionRegistry immutable public registry;
    ITeeMachineRegistry immutable public machineRegistry;
    uint256 private extensionId;  // Set after registration, not in struct
    
    constructor(address _registry, address _machineRegistry) {
        registry = ITeeExtensionRegistry(_registry);
        machineRegistry = ITeeMachineRegistry(_machineRegistry);
    }
    
    // Called once after registration to set extension ID
    function setExtensionId(uint256 _extensionId) external onlyOwner {
        extensionId = _extensionId;
    }
    
    function sendInstructions(
        uint256 instructionId,
        bytes32 opType,
        bytes32 opCommand,
        bytes memory message
    ) external payable {
        // Get random TEE machine(s) to handle this
        address[] memory teeIds = machineRegistry.getRandomTeeIds(extensionId, 1);
        
        // Build params struct
        TeeInstructionParams memory params = TeeInstructionParams({
            opType: opType,
            opCommand: opCommand,
            message: message,
            cosigners: new address[](0),      // No cosigners for demo
            cosignersThreshold: 0,             // No threshold needed
            claimBackAddress: msg.sender       // Return to caller if fails
        });
        
        // Send to registry
        registry.sendInstructions{value: msg.value}(teeIds, params);
    }
    
    function _getExtensionId() internal view returns (uint256) {
        return extensionId;
    }
}
```

**NOTE:** extensionId is NOT a struct field - it's state variable used internally to get teeIds.

## ⚠️ MEDIUM PRIORITY

### 4. Extension Never Registered
**Status:** Extension exists but not on-chain

**Required steps:**
```bash
cd fce-extension

# 1. Get full scaffold repo (if not already present)
# Our current fce-extension/ is missing:
#   - config/coston2/deployed-addresses.json
#   - scripts/pre-build.sh, post-build.sh, start-services.sh
#   - tools/cmd/register-extension CLI

# 2. Set environment
export LOCAL_MODE=false
export SIMULATED_TEE=true
export COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
# Set from deployed-addresses.json:
export TEE_EXTENSION_REGISTRY=0x????????
export TEE_MACHINE_REGISTRY=0x????????
export PRIVATE_KEY=0x...

# 3. Pre-build (generates config, checks environment)
./scripts/pre-build.sh

# 4. Build Docker image with attestation
docker build -t flareyield-rebalance:v1 .

# 5. Register using official CLI (NOT cast send)
# From scaffold tools/cmd/register-extension
./tools/cmd/register-extension \
  --sender-address <YOUR_INSTRUCTION_SENDER_ADDRESS> \
  --rpc-url $COSTON2_RPC_URL \
  --private-key $PRIVATE_KEY

# This calls register() on TeeExtensionRegistry (not registerExtension())
# and returns the assigned extension ID

# 6. Get extension ID for later use
EXTENSION_ID=$(# ... from register output or query registry)
echo "Extension ID: $EXTENSION_ID"

# 7. Set extension ID in InstructionSender contract
cast send <INSTRUCTION_SENDER_ADDRESS> \
  "setExtensionId(uint256)" \
  $EXTENSION_ID \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy
```

### 5. Infrastructure Never Started
**Status:** No running services

**Required:**
```bash
# Need from Flare team first:
# - Indexer DB host, port, database, user, password
# - Or run own indexer (different setup)

# Then:
# 1. Set up ngrok tunnel
ngrok http 8080

# 2. Update proxy config with:
#    - ngrok URL
#    - registry addresses
#    - indexer credentials

# 3. Start services
cd fce-extension
./scripts/start-services.sh --chain coston2

# 4. Verify tee-node is running and watching
curl http://localhost:9090/health
```

## 📝 REFERENCE: What Works Now

### ✅ On-Chain Trigger
- **Transaction:** `0xa2a2341d231107f0596f974d79fb3b2223da9f1034d811aff00c3c22e9001220`
- **Events:** InstructionSent + RebalanceRequested emitted
- **Payload:** Correctly encoded with VAULT_REBALANCE / CALCULATE_OPTIMAL
- **Idle assets:** 66,175,000 (66.175 FXRP)

### ✅ Op Type Constants
```solidity
// ParentVault.sol - CORRECT pattern
bytes32 public constant OP_TYPE_VAULT_REBALANCE = bytes32("VAULT_REBALANCE");
bytes32 public constant OP_COMMAND_CALCULATE_OPTIMAL = bytes32("CALCULATE_OPTIMAL");
```

### ✅ Extension Handler Code
- Decryption via tee-node /decrypt ✓
- Plain string constants ✓  
- Async APY calculation ✓
- Proper nonce reading ✓

## 🔧 REPAIR SEQUENCE

**If registry addresses become available:**

1. **Deploy Real InstructionSender** (2-3 hours)
   - Get registry addresses from config/coston2/deployed-addresses.json
   - Create proper interface with CORRECT TeeInstructionParams struct
   - Deploy contract with real registry addresses
   - Test compilation and basic calls

2. **Fix executeRebalance() Signature Verification** (3-6 hours)
   - Add ActionResult struct and fields
   - Change executeRebalance() function signature (BREAKING CHANGE)
   - Implement correct TEE_ACTION_RESULT_PREFIX (bytes32 literal, not hashed)
   - Implement correct hash structure (resultHash → payloadHash → prefixedHash)
   - Deploy new implementation
   - Upgrade both vaults
   - Re-test execution path

3. **Register Extension** (2-3 hours)
   - Get full scaffold repo if needed
   - Run pre-build.sh with real addresses
   - Build and push Docker image
   - Use official tools/cmd/register-extension CLI (not cast send)
   - Capture extension ID
   - Set extension ID in InstructionSender contract

4. **Start Infrastructure** (2-4 hours, assuming credentials work)
   - Set up ngrok tunnel
   - Configure ext-proxy with all addresses
   - Start tee-node + redis + proxy stack
   - Verify health endpoints

5. **Test End-to-End** (2-4 hours)
   - Deposit FXRP → auto-triggers requestRebalance()
   - Watch tee-node logs for instruction pickup
   - Verify extension processes request
   - Confirm signed ActionResult returned (with correct format)
   - Call NEW executeRebalance() signature with ActionResult
   - Verify vault state changed

**Total time if no blockers:** ~11-20 hours (not 7 as originally stated)  
**Total time if must debug/iterate:** 16-30 hours

## 🎯 DEMO OPTIONS

### Option A: Wait for Addresses, Do It Right
- Pros: Real end-to-end FCE integration, can honestly claim it works
- Cons: Blocked until Flare team provides addresses/credentials
- Time: Unknown wait + 7-20 hours work

### Option B: Manual Pre-Signed Demo
- Pros: Can do immediately, proves contract logic works
- Cons: Doesn't prove TEE integration, must be honest about limitations
- Time: 1-2 hours

**For Option B:**
```bash
# 1. Manually construct rebalance payload
# 2. Sign with deployer key (set as fccSigner)
# 3. Call executeRebalance() to prove execution works
# 4. Show on-chain trigger separately
# 5. Explain TEE integration is "in progress"
```

## 📧 QUESTIONS FOR FLARE TEAM (or check scaffold first)

1. **Is there a public fce-extension-scaffold repo we can clone?**
   - Our fce-extension/ is missing config/, scripts/, and tools/
   - Need config/coston2/deployed-addresses.json for registry addresses
   - Need tools/cmd/register-extension CLI for registration

2. **If scaffold is available:**
   - Where is it? (GitHub URL)
   - Does it have Coston2 addresses pre-populated?

3. **How do we obtain indexer DB credentials for tee-node?**
   - Host, port, database, user, password

4. **Can you confirm:**
   - TeeInstructionParams has 6 fields (not 5)?
   - TEE_ACTION_RESULT_PREFIX is bytes32 literal (not hashed)?
   - ActionResult fields needed in executeRebalance()?

---

**Last Updated:** 2026-08-05  
**Status:** Blocked on getting full scaffold repo OR obtaining addresses directly

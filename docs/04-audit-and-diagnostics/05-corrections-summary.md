# Corrections Summary - Ground Truth Verification
**Date:** 2026-08-05  
**Source:** Actual fce-extension-scaffold repo verification

## What Was Right (Verified Against Source)

### 1. TeeInstructionParams Struct ✅
Our "corrected" 6-field struct was **byte-perfect accurate**:
```solidity
struct TeeInstructionParams {
    bytes32 opType;
    bytes32 opCommand;
    bytes message;
    address[] cosigners;
    uint64 cosignersThreshold;
    address claimBackAddress;
}
```
- Source: `contracts/interfaces/ITeeExtensionRegistry.sol`
- No extensionId field (was correctly removed from draft)
- All 6 fields present and correct

### 2. ActionResult Signature Verification ✅
The 3-layer EIP-191 pattern was **architecturally correct**:
```solidity
bytes32 constant TEE_ACTION_RESULT_PREFIX = bytes32("TEE_ACTION_RESULT");
// Layer 1: resultHash from components
// Layer 2: payloadHash with PREFIX + chainId + resultHash
// Layer 3: EIP-191 wrapper
```
- Source: `examples/weather-insurance/contracts/WeatherInsurance.sol`
- Prefix is literal bytes32 (not hashed) ✓
- Three-layer hash structure matches ✓
- EIP-191 personal_sign wrapper ✓

### 3. TypeScript Framework ✅
Claims about `stringToBytes32Hex()` and `NodeClient.decrypt()` were accurate:
- Source: `typescript/src/base/encoding.ts` and `base/node.ts`
- TypeScript track exists alongside Go and Python
- Framework converts plain strings to padded bytes32
- Decryption goes through tee-node /decrypt endpoint

### 4. Registry Address is Available ✅
Not blocked waiting on Flare team:
- Source: `config/coston2/deployed-addresses.json`
- FlareTeeManager: `0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE`
- Same address for both ITeeExtensionRegistry and ITeeMachineRegistry (diamond proxy)

## What Was Wrong (Corrected)

### 1. instructionId/actionId Type ❌→✅
**Error:** Used `uint256` everywhere  
**Correct:** `bytes32`

**Impact:**
- MockInstructionSender: wrong event signature
- ParentVault state variable: wrong type
- ActionResult struct: wrong field type
- All ABI mismatches would revert on-chain

**Source:** `contracts/interfaces/ITeeExtensionRegistry.sol` and `go-flare-common/types/data_fixed.go`

### 2. sendInstructions Signature ❌→✅
**Error:**
```solidity
function sendInstructions(
    uint256 instructionId,  // ← Doesn't take ID as input
    bytes32 opType,
    bytes32 opCommand,
    bytes memory message
) external;
```

**Correct:**
```solidity
function sendInstructions(
    address[] memory teeIds,          // ← Different args
    TeeInstructionParams calldata params
) external payable returns (bytes32 instructionId);  // ← Returns ID!
```

**Impact:** Complete ABI mismatch - would fail to compile or revert

**Source:** `contracts/interfaces/ITeeExtensionRegistry.sol`

### 3. setExtensionId Pattern ❌→✅
**Error:**
```solidity
function setExtensionId(uint256 _id) external onlyOwner {
    extensionId = _id;
}
```

**Correct:**
```solidity
function setExtensionId() external {
    // Self-discovers by scanning registry
    uint256 nextId = registry.nextPublicExtensionId();
    for (uint256 id = 0x10000; id < nextId; id++) {
        if (registry.getExtension(id).instructionSender == address(this)) {
            extensionId = id;
            return;
        }
    }
    revert("Extension not found");
}
```

**Impact:** Wrong pattern - requires caller to know ID manually

**Source:** `contracts/InstructionSender.sol`

### 4. Registration CLI Flags ❌→✅
**Error:**
```bash
./tools/cmd/register-extension \
  --sender-address <ADDR> \
  --rpc-url <URL> \
  --private-key <KEY>
```

**Correct:**
```bash
go run ./cmd/register-extension \
  -a config/coston2/deployed-addresses.json \
  -c https://coston2-api.flare.network/ext/C/rpc \
  --instructionSender <ADDR> \
  --governanceHash <OPTIONAL>
```

**Impact:** Tool exists but flags were guessed

**Source:** `cmd/register-extension/main.go`

### 5. Port Confusion ❌→✅
**Error:**
- ngrok http 8080
- curl localhost:9090/health

**Correct:**
- ngrok http 6674 (ext-proxy needs public tunnel)
- curl localhost:6674/info (info endpoint, not /health)

**Impact:** Wrong service exposed, wrong health check

**Source:** `docs/deployment.md` and service configuration

### 6. Missing: setTeeAddress() Step ❌→✅
**Error:** Never mentioned in any of our 10 docs

**Correct:** Required step after services start:
```bash
TEE_ADDRESS=$(curl localhost:6674/info | jq -r '.teeAddress')
cast send <VAULT> "setTeeAddress(address)" $TEE_ADDRESS ...
```

**Impact:** executeRebalance() would always revert even with correct signature

**Source:** `examples/weather-insurance/scripts/extension-post-setup.sh`

### 7. Terminology ❌→✅
**Error:** "FCE = Flare Confidential Extension"  
**Correct:** "FCE = Flare Compute Extensions" (FCC = Flare Confidential Compute)

**Impact:** Conceptual confusion

**Source:** Official documentation

## Severity Assessment

### Critical (Would Hard Revert)
1. ✅ **FIXED:** instructionId as bytes32 not uint256
2. ✅ **FIXED:** sendInstructions signature completely wrong
3. ✅ **FIXED:** Missing setTeeAddress() - signatures would never verify
4. ⚠️ **NOTED:** Port 6674 not 8080 for public tunnel

### Important (Would Cause Confusion)
1. ✅ **FIXED:** setExtensionId() pattern (self-discovery vs manual)
2. ✅ **FIXED:** Registration CLI flags
3. ✅ **FIXED:** Health check endpoint

### Documentation Quality
1. ✅ **VERIFIED:** TeeInstructionParams struct was already correct
2. ✅ **VERIFIED:** ActionResult signature pattern was architecturally correct
3. ✅ **VERIFIED:** TypeScript framework claims were accurate
4. ✅ **RESOLVED:** Registry address blocker (was available all along)

## What This Means

### The Good
- **Core architecture was sound** - the 3-layer signature verification we drafted matches real WeatherInsurance.sol
- **Struct understanding was correct** - 6 fields, no extensionId, all present
- **Not actually blocked** - registry address exists in config file
- **TypeScript track is real** - framework claims were accurate

### The Bad
- **Type mismatches everywhere** - bytes32 vs uint256 would hard revert
- **Function signature totally wrong** - sendInstructions wouldn't compile
- **Missing critical setup step** - setTeeAddress() never mentioned
- **Port confusion** - would expose wrong service

### The Actionable
1. **Can start immediately** - deploy corrected InstructionSender (2-3 hours)
2. **Can upgrade vault** - fix types and add ActionResult (3-6 hours)
3. **Can register extension** - commands are now correct (2-3 hours)
4. **Still blocked on one thing** - indexer DB credentials for Phase 4

## Confidence Level

**Before verification:** 60% - knew general pattern but guessed details  
**After verification:** 90% - have exact source code, know what's wrong, can fix systematically

**Remaining uncertainty:**
- Indexer DB credentials (must get from Flare)
- Whether FCC system is stable enough for demo (docs say "not yet fully public")
- Time estimate (12-18 hours assumes no major debugging)

## Next Steps

1. ✅ Create corrected InstructionSender contract
2. ✅ Create corrected ParentVault upgrade
3. ✅ Document exact deployment sequence
4. ⏳ Execute Phase 1-2 (can do now)
5. ⏳ Get DB credentials for Phase 4
6. ⏳ Execute Phase 3-5 (once credentials available)

---

**Bottom Line:** We had the right mental model but wrong implementation details. The corrections are systematic and fixable. The "blocker" wasn't a blocker. We can start building immediately.

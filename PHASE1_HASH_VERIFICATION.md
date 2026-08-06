# Phase 1: Hash Construction Verification

**Question:** Does our test helper's signing logic match what the real TEE produces?

## Line-by-Line Comparison

### Our Test Helper (RebalanceTestHelper.sol)

```solidity
// Layer 1: resultHash from components
bytes32 resultHash = keccak256(abi.encodePacked(
    keccak256(resultData),
    actionId,
    keccak256(bytes(submissionTag)),
    status
));

// Layer 2: payloadHash with domain separation
bytes32 payloadHash = keccak256(abi.encode(
    TEE_ACTION_RESULT_PREFIX,  // bytes32("TEE_ACTION_RESULT")
    block.chainid,
    resultHash
));

// Layer 3: EIP-191 personal_sign wrapper
return keccak256(abi.encodePacked(
    "\x19Ethereum Signed Message:\n32",
    payloadHash
));
```

### Our Contract (ParentVault.executeRebalance)

```solidity
// Layer 1: resultHash from action result components
bytes32 resultHash = keccak256(abi.encodePacked(
    keccak256(resultData),
    actionId,
    keccak256(bytes(submissionTag)),
    status
));

// Layer 2: payloadHash with domain separation
bytes32 payloadHash = keccak256(abi.encode(
    TEE_ACTION_RESULT_PREFIX,  // Literal bytes32("TEE_ACTION_RESULT"), not hashed
    block.chainid,
    resultHash
));

// Layer 3: EIP-191 personal_sign wrapper
bytes32 ethHash = keccak256(abi.encodePacked(
    "\x19Ethereum Signed Message:\n32",
    payloadHash
));
```

### Official WeatherInsurance.sol (from audit report verification)

```solidity
bytes32 resultHash = keccak256(abi.encodePacked(
    keccak256(_resultData),
    _actionId,
    keccak256(bytes(_submissionTag)),
    _status
));

bytes32 payloadHash = keccak256(abi.encode(
    TEE_ACTION_RESULT_PREFIX,
    block.chainid,
    resultHash
));

address signer = _recover(_ethSigned(payloadHash), _signature);

// Where _ethSigned does:
function _ethSigned(bytes32 messageHash) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(
        "\x19Ethereum Signed Message:\n32",
        messageHash
    ));
}
```

## Verification Checklist

### Layer 1: resultHash
- ✅ Uses `abi.encodePacked` (not `abi.encode`)
- ✅ Element 1: `keccak256(resultData)` - hashes the data first
- ✅ Element 2: `actionId` - bytes32 directly
- ✅ Element 3: `keccak256(bytes(submissionTag))` - hashes the string
- ✅ Element 4: `status` - uint8 directly
- ✅ **Order matches official exactly**

### Layer 2: payloadHash
- ✅ Uses `abi.encode` (not `abi.encodePacked`)
- ✅ Element 1: `TEE_ACTION_RESULT_PREFIX` - literal bytes32, not hashed
- ✅ Element 2: `block.chainid` - chain ID for domain separation
- ✅ Element 3: `resultHash` - from layer 1
- ✅ **Order matches official exactly**

### Layer 3: EIP-191 Wrapper
- ✅ Uses `abi.encodePacked` (not `abi.encode`)
- ✅ Element 1: `"\x19Ethereum Signed Message:\n32"` - exact prefix
- ✅ Element 2: `payloadHash` - from layer 2
- ✅ **Matches official EIP-191 personal_sign exactly**

## Critical Details Verified

1. **abi.encodePacked vs abi.encode usage:**
   - Layer 1: `abi.encodePacked` ✅
   - Layer 2: `abi.encode` ✅
   - Layer 3: `abi.encodePacked` ✅

2. **What gets hashed when:**
   - resultData: hashed before packing ✅
   - submissionTag: hashed before packing ✅
   - actionId: NOT hashed (already bytes32) ✅
   - status: NOT hashed (uint8) ✅
   - TEE_ACTION_RESULT_PREFIX: NOT hashed (literal bytes32) ✅

3. **Data types:**
   - actionId: bytes32 (not uint256) ✅
   - status: uint8 ✅
   - TEE_ACTION_RESULT_PREFIX: bytes32 ✅

## Test Evidence

From actual test trace (testExecuteRebalanceWithActionResultFormat):
```
├─ [3000] PRECOMPILES::ecrecover(
│   0xbe3f5c8c4121561ddf85ad726e2e29f546c1273ecb7047cd4b037858df2330ba,
│   28,
│   41267649451237073422546844403649681286049564057695767216322682070541595843883,
│   3025414479999884872675184418470062673157461560446396438354620462484623768667
│ ) [staticcall]
│   └─ ← [Return] 0x2e988A386a799F506693793c6A5AF6B54dfAaBfB
```

This shows:
1. The hash being verified: `0xbe3f5c8c...`
2. The signature components (v=28, r=..., s=...)
3. **The recovered address: `0x2e988A386a799F506693793c6A5AF6B54dfAaBfB`**
4. This matches the `teeAddress` set in setUp (derived from `teeNodePrivateKey`)

## Conclusion

✅ **The test helper's hash construction is byte-for-byte identical to:**
1. The ParentVault contract's verification logic
2. The official WeatherInsurance.sol pattern (verified in audit report)

✅ **The test proves internal consistency:**
- Test helper signs with private key → produces signature
- Contract verifies signature → recovers same address
- ecrecover trace confirms: recovered address matches expected teeAddress

## What This Doesn't Prove (Yet)

❌ **Not proven:** That a real TEE node running go-flare-common would produce the same hash

**Why:** We're testing Solidity signing against Solidity verification. Both could be wrong in the same way and still pass.

**To prove:** Would need either:
1. A signature from an actual running TEE node (local dev setup with real tee-node)
2. Or: Cross-reference against go-flare-common's signing.TEEActionResult implementation

## Deployment Status

⚠️ **Nothing is deployed yet**
- These fixes exist only in local Foundry tests
- The on-chain ParentVault (if any) still has the old broken code
- Phase 2 (deploy real contracts) hasn't started

## Risk Assessment

**Medium-Low Risk:** The pattern matches official Solidity examples exactly, and we're using standard Solidity crypto primitives (keccak256, abi.encode, abi.encodePacked, ECDSA.recover). The main risk is if there's a subtle difference between how Solidity and Go encode the same data structure that we haven't tested.

**Mitigation:** Before production use, should test against actual TEE signature (Phase 3-5 with real tee-node).

**For Phase 2:** Safe to proceed - we're deploying contracts that match official patterns, even if not yet tested against real TEE.

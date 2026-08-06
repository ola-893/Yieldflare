# Phase 1: ParentVault Fix - Remaining Tasks

## ✅ Completed
- [x] Created ITeeExtensionRegistry interface
- [x] Created ITeeMachineRegistry interface  
- [x] Updated IInstructionSender interface with correct signature
- [x] Fixed ParentVault.sol:
  - [x] Added teeAddress state variable and setter
  - [x] Removed EIP-712 (MessageHashUtils, domain separator, etc.)
  - [x] Replaced with EIP-191 3-layer signature verification
  - [x] Changed executeRebalance to accept ActionResult parameters
  - [x] Fixed requestRebalance to use new sendInstructions signature
  - [x] Changed instructionId from uint256 to bytes32
- [x] Updated IParentVault interface
- [x] Fixed MockInstructionSender
- [x] Created RebalanceTestHelper

## ⏳ Still TODO
- [ ] Update test/ParentVault.t.sol to use new executeRebalance signature
- [ ] Update script/ExecuteInitialRebalance.s.sol
- [ ] Verify contract compiles cleanly
- [ ] Create deployment script for Phase 2 (real InstructionSender)

## Files that need test updates:
1. `test/ParentVault.t.sol` - 10 calls to executeRebalance() need converting to ActionResult format
2. `script/ExecuteInitialRebalance.s.sol` - 1 call needs converting

## How to update executeRebalance calls:

**Old pattern:**
```solidity
vault.executeRebalance(payload);
```

**New pattern:**
```solidity
bytes memory resultData = RebalanceTestHelper.encodeRebalancePayload(payload);
bytes32 actionId = keccak256(abi.encode("test", block.timestamp));
string memory submissionTag = "test-submission";
uint8 status = 1;

bytes32 hash = RebalanceTestHelper.computeActionResultHash(
    resultData, actionId, submissionTag, status
);
(uint8 v, bytes32 r, bytes32 s) = vm.sign(teePrivateKey, hash);
bytes memory signature = abi.encodePacked(r, s, v);

vault.executeRebalance(resultData, actionId, submissionTag, status, signature);
```

## Next Steps After Phase 1:
1. Deploy new ParentVault implementation
2. Upgrade via UUPS
3. Call setTeeAddress() with test TEE address
4. Move to Phase 2 (real InstructionSender)

# 🛡️ Flare Confidential Extension (FCE) Integration Status

**Last Updated:** February 3, 2026  
**Status:** 🟡 **FCE-READY ARCHITECTURE (Integration Pending)**

---

## 📋 Executive Summary

Our FlareYield platform has built **FCE-compatible smart contracts** but has **not yet integrated with the full FCE framework**. Our contracts can accept TEE-signed payloads, but we're not using Flare's official `InstructionSender.sol` → `tee-node` → Extension flow.

**Current State:**
- ✅ Smart contracts ready for FCE signatures
- ❌ No InstructionSender.sol integration
- ❌ No FCE extension handler built
- ❌ No TeeExtensionRegistry.sol registration

---

## 🔍 What is Flare Confidential Extension (FCE)?

### Official FCE Architecture

Based on [dev.flare.network/fcc](https://dev.flare.network/fcc/guides/getting-started) and [fce-extension-scaffold](https://github.com/flare-foundation/fce-extension-scaffold):

```
┌─────────────────────────────────────────────────────────────┐
│                    TEE Enclave Container                    │
│                                                             │
│  ┌──────────────────┐         ┌─────────────────────────┐  │
│  │  Extension App   │  POST   │      tee-node           │  │
│  │  (Go/Python/TS)  │ ─────>  │  (Signs & Dispatches)   │  │
│  │  :$EXT_PORT      │ /decrypt│  :$SIGN_PORT            │  │
│  └──────────────────┘         └─────────────────────────┘  │
└───────────────────────────────────┬─────────────────────────┘
                                    │ POST /action
                                    ▼
┌─────────────────────────────────────────────────────────────┐
│              On-Chain Smart Contracts                       │
│                                                             │
│  • InstructionSender.sol (emits instructions)              │
│  • TeeExtensionRegistry.sol (validates attestations)       │
│  • ParentVault.sol (executes signed payloads)              │
└─────────────────────────────────────────────────────────────┘
```

### FCE Workflow

1. **Trigger:** Smart contract calls `InstructionSender.sendInstructions(opType, opCommand, payload)`
2. **Dispatch:** `tee-node` reads on-chain event, forwards to extension via `POST /action`
3. **Processing:** Extension processes in TEE, calls `POST /decrypt` if needed
4. **Signing:** Extension returns `ActionResult`, `tee-node` signs with attested key
5. **Execution:** Signed transaction submitted on-chain, verified against `TeeExtensionRegistry`

---

## ✅ What We Have Built

### 1. FCE-Compatible Smart Contracts

**ParentVault.sol - Ready for FCE Signatures**

```solidity
// Our implementation already supports FCE signature verification
function executeRebalance(RebalancePayload calldata payload) 
    external 
    whenNotPaused 
    nonReentrant 
{
    // Verify EIP-712 signature from fccSigner
    address recoveredSigner = ECDSA.recover(
        _rebalanceDigest(payload), 
        payload.signature
    );
    if (recoveredSigner != fccSigner) revert InvalidTeeSignature();
    
    // Additional FCE-compatible protections
    if (payload.nonce != rebalanceNonce) revert InvalidNonce();
    if (block.timestamp > payload.deadline) revert RebalanceExpired();
    
    // TWAP protection (FCE best practice)
    if (payload.twapEnd - payload.twapStart < MIN_TWAP_WINDOW) {
        revert InvalidTwapWindow();
    }
    
    // Atomic rebalance execution
    // ...
}
```

**Key Features:**
- ✅ EIP-712 signature verification (FCE-compatible)
- ✅ `fccSigner` address verification (can be set to TEE key)
- ✅ Nonce replay protection
- ✅ TWAP oracle protection
- ✅ Slippage protection
- ✅ ReentrancyGuard
- ✅ Pausability

### 2. Manual FCE Simulation

**Script: ExecuteInitialRebalance.s.sol**

We can manually create and sign payloads that match the FCE format:

```solidity
// Creates EIP-712 signed payload (same format FCE would use)
function _createPayload(uint256 nonce) private view 
    returns (IParentVault.RebalancePayload memory) 
{
    return IParentVault.RebalancePayload({
        newStrategy: FTSO_ADAPTER,
        minAmountOut: 0,
        nonce: nonce,
        deadline: block.timestamp + 1 hours,
        twapStart: block.timestamp - 24 hours,
        twapEnd: block.timestamp,
        strategyDataHash: keccak256("rebalance-data"),
        signature: _sign(payload, fccPrivateKey)
    });
}
```

This demonstrates the contract interface works correctly, even without full FCE integration.

---

## ❌ What We're Missing for Full FCE Integration

### 1. InstructionSender Integration

**Current:** Our contracts don't emit FCE instructions.  
**Needed:** Integrate with `InstructionSender.sol` to trigger rebalances.

```solidity
// Add to ParentVault.sol
import {IInstructionSender} from "@flare/fcc/IInstructionSender.sol";

contract ParentVault is ERC4626Upgradeable {
    IInstructionSender public instructionSender;
    uint256 public instructionId;
    uint256 public rebalanceThreshold = 1_000 ether; // 1000 FXRP
    
    // Emits FCE instruction when threshold met
    function requestRebalance() external {
        uint256 idleAssets = IERC20(asset()).balanceOf(address(this));
        
        if (idleAssets < rebalanceThreshold) {
            revert InsufficientIdleAssets();
        }
        
        // Encode vault state for FCE
        bytes memory payload = abi.encode(
            address(this),        // vault address
            idleAssets,          // available capital
            approvedStrategies,  // strategy options
            liquidityBufferBps   // constraints
        );
        
        // Emit instruction on-chain
        instructionSender.sendInstructions(
            instructionId++,
            keccak256("VAULT_REBALANCE"),  // opType
            keccak256("CALCULATE_OPTIMAL"), // opCommand
            payload
        );
        
        emit RebalanceRequested(instructionId - 1, idleAssets);
    }
}
```

### 2. FCE Extension Handler

**Current:** No FCE extension handler exists.  
**Needed:** Build extension using `fce-extension-scaffold`.

**File Structure:**
```
fce-extension/
├── Dockerfile                    # TEE container definition
├── extension.json               # Extension metadata
├── src/
│   ├── handlers/
│   │   └── rebalanceHandler.ts  # Vault rebalance logic
│   ├── services/
│   │   ├── apyCalculator.ts     # Yield calculation
│   │   └── strategySelector.ts  # Strategy optimization
│   └── index.ts                 # Main entry point
└── attestation/
    └── verify.sh                # Hardware attestation
```

**Handler Implementation:**
```typescript
// fce-extension/src/handlers/rebalanceHandler.ts

import { ActionData, ActionResult } from '@flare/fce-types';
import { decrypt, sign } from '@flare/tee-node-client';

interface VaultState {
    vaultAddress: string;
    idleAssets: bigint;
    approvedStrategies: string[];
    liquidityBuffer: number;
}

export async function handleRebalance(
    action: ActionData
): Promise<ActionResult> {
    console.log('[Rebalance] Processing instruction:', action.instructionId);
    
    // 1. Decrypt vault state (confidential inside TEE)
    const encryptedPayload = action.message;
    const decrypted = await decrypt(encryptedPayload);
    const vaultState: VaultState = JSON.parse(decrypted);
    
    // 2. Calculate APYs confidentially
    const ftsoAPY = await calculateFTSOYield(vaultState.vaultAddress);
    const sparkAPY = await calculateSparkDEXYield(vaultState.vaultAddress);
    const enosysAPY = await calculateEnosysYield(vaultState.vaultAddress);
    
    console.log('[Rebalance] APYs:', { ftsoAPY, sparkAPY, enosysAPY });
    
    // 3. Select optimal strategy
    const strategies = [
        { address: FTSO_ADAPTER, apy: ftsoAPY, risk: 'low' },
        { address: SPARK_ADAPTER, apy: sparkAPY, risk: 'medium' },
        { address: ENOSYS_ADAPTER, apy: enosysAPY, risk: 'medium' }
    ].filter(s => vaultState.approvedStrategies.includes(s.address));
    
    const optimalStrategy = strategies.reduce((best, current) => 
        current.apy > best.apy ? current : best
    );
    
    console.log('[Rebalance] Selected:', optimalStrategy.address);
    
    // 4. Build rebalance payload
    const nonce = await vault.rebalanceNonce();
    const payload = {
        newStrategy: optimalStrategy.address,
        minAmountOut: calculateMinOutput(vaultState.idleAssets, 0.005), // 0.5% slippage
        nonce: nonce,
        deadline: Date.now() + 3600, // 1 hour
        twapStart: Date.now() - 86400, // 24h ago
        twapEnd: Date.now(),
        strategyDataHash: keccak256(JSON.stringify(optimalStrategy)),
        signature: '' // Will be added by tee-node
    };
    
    // 5. Return result - tee-node will sign and submit
    return {
        instructionId: action.instructionId,
        result: encodeRebalancePayload(payload),
        success: true,
        metadata: {
            selectedStrategy: optimalStrategy.address,
            expectedAPY: optimalStrategy.apy,
            idleAssets: vaultState.idleAssets.toString()
        }
    };
}
```

### 3. TeeExtensionRegistry Registration

**Current:** No registered TEE extension.  
**Needed:** Register extension with hardware attestation.

**Steps:**
```bash
# 1. Build TEE container
cd fce-extension
docker build -t flareyield-rebalance:v1 .

# 2. Generate attestation
./scripts/pre-build.sh

# 3. Register on-chain
./tools/cmd/register-extension \
  --name "FlareYield Rebalance" \
  --image-hash $(docker images --no-trunc --quiet flareyield-rebalance:v1) \
  --network coston2

# 4. Verify registration
cast call $TEE_EXTENSION_REGISTRY \
  "isExtensionRegistered(bytes32)(bool)" \
  $(cast keccak "flareyield-rebalance-v1") \
  --rpc-url $COSTON2_RPC_URL
```

### 4. Attestation Verification

**Current:** `fccSigner` is just a regular EOA address.  
**Needed:** Verify hardware attestation quotes.

```solidity
// Add to ParentVault.sol
import {ITeeExtensionRegistry} from "@flare/fcc/ITeeExtensionRegistry.sol";

function setFccSigner(address newSigner) external onlyOwner {
    // Verify signer is registered in TEE Extension Registry
    bytes32 extensionId = keccak256("flareyield-rebalance-v1");
    
    require(
        teeExtensionRegistry.isExtensionRegistered(extensionId),
        "Extension not registered"
    );
    
    require(
        teeExtensionRegistry.getExtensionSigner(extensionId) == newSigner,
        "Signer not attested"
    );
    
    emit FccSignerUpdated(fccSigner, newSigner);
    fccSigner = newSigner;
}
```

---

## 🎯 Integration Roadmap

### Phase 1: Smart Contract Updates (1-2 days)
- [ ] Add `InstructionSender` dependency
- [ ] Implement `requestRebalance()` function
- [ ] Add `instructionSender` configuration
- [ ] Update tests for FCE flow

### Phase 2: FCE Extension Development (3-5 days)
- [ ] Clone `fce-extension-scaffold`
- [ ] Implement rebalance handler
- [ ] Add APY calculation services
- [ ] Add strategy selection logic
- [ ] Test in local TEE simulator

### Phase 3: Attestation & Registration (2-3 days)
- [ ] Build Docker container with attestation
- [ ] Deploy to GCP Confidential Space / AMD SEV
- [ ] Generate hardware attestation quote
- [ ] Register on `TeeExtensionRegistry.sol`
- [ ] Verify on-chain attestation

### Phase 4: Integration Testing (2-3 days)
- [ ] End-to-end test: InstructionSender → Extension → ParentVault
- [ ] Verify signature verification works
- [ ] Test failure scenarios
- [ ] Monitor gas costs

### Phase 5: Production Deployment (1 week)
- [ ] Security audit of extension code
- [ ] Deploy to production TEE infrastructure
- [ ] Monitor initial rebalances
- [ ] Gradual rollout with TVL caps

**Total Estimated Time:** 2-3 weeks

---

## 💡 Why Our Current Architecture Still Works

### For Hackathon / MVP:

**What We Can Demonstrate:**
1. ✅ **Smart contracts are FCE-ready** (signature verification, TWAP, etc.)
2. ✅ **Manual payload generation** shows the interface works
3. ✅ **Security measures** match FCE best practices
4. ✅ **Architecture is compatible** with FCE integration

**What We Can Say:**
> "Our smart contracts are designed to accept FCE-signed payloads. The `executeRebalance()` function verifies EIP-712 signatures, enforces TWAP windows, and includes all security measures recommended for FCE extensions. 
>
> For the hackathon, we demonstrate manual rebalancing using our Forge script. The full FCE integration - with InstructionSender, TEE extension handler, and TeeExtensionRegistry attestation - is straightforward to add because we've architected the contracts with FCE compatibility from day one."

### Key Points:

1. **Not Misleading:** We're not claiming to have full FCE integration
2. **Architecture Ready:** Contracts support FCE signatures and flow
3. **Clear Roadmap:** Documented path to full integration
4. **Honest Demo:** Show what works, explain what's next

---

## 📊 Comparison: Our Implementation vs. Full FCE

| Feature | Our Implementation | Full FCE Integration |
|---------|-------------------|---------------------|
| **EIP-712 Signatures** | ✅ Implemented | ✅ Same |
| **Signature Verification** | ✅ Manual EOA | ✅ TEE-attested key |
| **Trigger Mechanism** | 🤚 Manual script | ✅ InstructionSender.sol |
| **Compute Environment** | 💻 Local/server | ✅ Hardware TEE enclave |
| **Attestation** | ❌ None | ✅ TeeExtensionRegistry |
| **APY Calculation** | 🤚 Off-chain manual | ✅ Confidential in TEE |
| **Automation** | ❌ Manual execution | ✅ 24/7 autonomous |
| **Security** | ✅ On-chain protections | ✅ TEE + On-chain |

---

## 🎬 Demo Talking Points

### What to Say:

> "FlareYield is architected for Flare Confidential Extension integration. Our ParentVault contract includes:
>
> - **EIP-712 signature verification** for FCE-signed payloads
> - **TWAP oracle protection** (24-hour minimum windows)
> - **Slippage protection** and reentrancy guards
> - **fccSigner verification** (ready for TEE-attested keys)
>
> We're demonstrating manual rebalancing today, but the smart contract interface is FCE-ready. Adding full FCE integration means:
> 1. Connecting to InstructionSender.sol
> 2. Building an extension handler for APY calculation
> 3. Registering with TeeExtensionRegistry
>
> The core innovation - trustless yield optimization with cryptographic verification - is already implemented."

### What NOT to Say:

❌ "We have full FCE integration"  
❌ "Our rebalancing runs in a TEE enclave"  
❌ "We use hardware attestation"

### What TO Say:

✅ "Our contracts support FCE-signed payloads"  
✅ "We're FCE-compatible and integration-ready"  
✅ "Our architecture follows FCE best practices"

---

## 🏁 Conclusion

**Current Status:** 🟡 **FCE-Ready, Integration Pending**

- ✅ Smart contracts ready for FCE signatures
- ✅ Security measures match FCE requirements  
- ✅ Clear integration roadmap
- ❌ Full FCE integration not yet complete

**Recommendation:** Be transparent about current state, emphasize that the architecture is FCE-compatible, and demonstrate the working smart contract interface.

---

**Last Updated:** February 3, 2026  
**Next Steps:** Implement InstructionSender integration (Phase 1)


# FCE Integration Action Plan - Reality-Based
**Date:** August 5, 2026  
**Based On:** Independent audit against official Flare docs + scaffold repo

## Executive Summary

**Current State:** Phase 0 complete, Phase 1-5 fictional  
**Honest Assessment:** 8-12 focused hours to working end-to-end  
**Main Blocker:** Indexer DB credentials from Flare support  

### What Actually Works ✅
- ParentVault UUPS upgrades deployed and verified
- requestRebalance() emits correctly encoded events
- On-chain infrastructure is sound
- Architecture is compatible with real FCE

### What Doesn't Work ❌
- MockInstructionSender goes nowhere (not registered)
- executeRebalance() uses wrong signature scheme (EIP-712 instead of EIP-191)
- executeRebalance() function signature incompatible with TEE output
- No extension registered on TeeExtensionRegistry
- No TEE services running
- No end-to-end flow tested

---

## Phase 1: Fix ParentVault Contract (~3 hours)

### Problem
Current deployed executeRebalance() has two fatal issues:
1. Uses EIP-712 signature scheme (TEE uses EIP-191 personal_sign)
2. Takes `RebalancePayload` directly (TEE sends `ActionResult` wrapper)

### Solution
Deploy new implementation with corrected function:

```solidity
// CORRECT signature to match TEE output
function executeRebalance(
    bytes calldata resultData,      // ABI-encoded RebalancePayload
    bytes32 actionId,                // bytes32 NOT uint256
    string calldata submissionTag,
    uint8 status,
    bytes calldata signature
) external nonReentrant {
    require(teeAddress != address(0), "TEE address not set");
    require(status == 1, "TEE reported failure");
    
    // Layer 1: resultHash from components
    bytes32 resultHash = keccak256(abi.encodePacked(
        keccak256(resultData),
        actionId,
        keccak256(bytes(submissionTag)),
        status
    ));
    
    // Layer 2: payloadHash with domain separation
    bytes32 payloadHash = keccak256(abi.encode(
        bytes32("TEE_ACTION_RESULT"),  // Literal, not hashed
        block.chainid,
        resultHash
    ));
    
    // Layer 3: EIP-191 personal_sign wrapper
    bytes32 ethHash = keccak256(abi.encodePacked(
        "\x19Ethereum Signed Message:\n32",
        payloadHash
    ));
    
    address signer = ECDSA.recover(ethHash, signature);
    require(signer == teeAddress, "Invalid TEE signature");
    
    // Decode and execute
    RebalancePayload memory payload = abi.decode(resultData, (RebalancePayload));
    _executeRebalanceLogic(payload);
}

// Add required state variable
address public teeAddress;

// Add setter (onlyOwner)
function setTeeAddress(address _teeAddress) external onlyOwner {
    teeAddress = _teeAddress;
}
```

### Deployment Steps
```bash
# 1. Create new implementation
forge build

# 2. Deploy via upgrade script
forge script script/UpgradeParentVault.s.sol \
  --rpc-url $COSTON2_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify

# 3. Verify upgrade
cast call $PARENT_VAULT "version()(uint256)"  # Should increment
```

**Time:** 3 hours (includes testing signature verification)

---

## Phase 2: Deploy Real InstructionSender (~2 hours)

### Problem
Current `MockInstructionSender` at 0x4D7e4817aF347141dDaBd44C4de932F382813e67:
- Not registered with TeeExtensionRegistry
- Doesn't call real registry
- Events go nowhere

### Solution
Deploy InstructionSender that matches scaffold pattern:

```solidity
// CORRECT implementation
contract InstructionSender is IInstructionSender {
    ITeeExtensionRegistry public immutable registry;
    ITeeMachineRegistry public immutable machineRegistry;
    uint256 public extensionId;
    
    constructor(
        address _registry,
        address _machineRegistry
    ) {
        registry = ITeeExtensionRegistry(_registry);
        machineRegistry = ITeeMachineRegistry(_machineRegistry);
    }
    
    // Self-discovers extension ID (DO NOT MODIFY THIS PATTERN)
    function setExtensionId() external {
        require(extensionId == 0, "Already set");
        uint256 nextId = registry.nextPublicExtensionId();
        for (uint256 id = 0x10000; id < nextId; id++) {
            if (registry.getTeeExtensionInstructionsSender(id) == address(this)) {
                extensionId = id;
                return;
            }
        }
        revert("Extension ID not found");
    }
    
    function sendInstructions(
        TeeInstructionParams calldata params
    ) external payable returns (bytes32 instructionId) {
        // Get random TEEs for this extension
        address[] memory teeIds = machineRegistry.getRandomTeeIds(
            extensionId,
            3  // Request 3 TEEs for redundancy
        );
        require(teeIds.length > 0, "No TEEs available");
        
        // Call real registry
        instructionId = registry.sendInstructions{value: msg.value}(
            teeIds,
            params
        );
        
        emit InstructionSent(instructionId, params);
    }
}
```

### Deployment Steps
```bash
# 1. Deploy with registry addresses from config
REGISTRY=0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE  # From deployed-addresses.json

forge create src/InstructionSender.sol:InstructionSender \
  --rpc-url $COSTON2_RPC \
  --private-key $PRIVATE_KEY \
  --constructor-args $REGISTRY $REGISTRY \
  --verify

# 2. Update ParentVault to use new sender
cast send $PARENT_VAULT \
  "setInstructionSender(address)" $NEW_INSTRUCTION_SENDER \
  --rpc-url $COSTON2_RPC \
  --private-key $PRIVATE_KEY
```

**Time:** 2 hours

---

## Phase 3: Configure Scaffold Environment (~1 hour)

### Clone and Configure
```bash
# 1. Clone scaffold
git clone https://github.com/flare-foundation/fce-extension-scaffold.git fce-scaffold
cd fce-scaffold

# 2. Create .env
cp .env.example .env

# Edit .env:
DEPLOYMENT_PRIVATE_KEY=<your_key>
INITIAL_OWNER=<your_address>
CHAIN_URL=https://coston2-api.flare.network/ext/C/rpc
LOCAL_MODE=false
SIMULATED_TEE=true  # Start with simulation first
```

### Configure Extension Proxy
```bash
# 1. Copy config template
cp config/proxy/extension_proxy.coston2.docker.toml.example \
   config/proxy/extension_proxy.coston2.docker.toml

# 2. Edit indexer section
[db]
host = "34.38.42.208"  # From docs
port = 3306
database = "indexer"
username = "<GET_FROM_FLARE_SUPPORT>"
password = "<GET_FROM_FLARE_SUPPORT>"

# 3. Get ngrok tunnel
ngrok http 6674  # NOTE: 6674 not 8080!
# Copy https URL

# 4. Set EXT_PROXY_URL in .env
EXT_PROXY_URL=https://xxxx.ngrok.io
```

**Time:** 1 hour (waiting on DB credentials)

---

## Phase 4: Adapt TypeScript Extension (~3 hours)

### Problem
Current extension uses custom HTTP server pattern (Go-style). TypeScript uses Framework class.

### Solution
Match the scaffold's TypeScript pattern exactly:

```typescript
// typescript/src/app/handlers.ts
import { Framework, HandlerResult } from '../base/framework';
import { NodeClient } from '../base/node';
import { ethers } from 'ethers';

// Match your deployed constants
const VAULT_REBALANCE = ethers.zeroPadBytes(ethers.toUtf8Bytes("VAULT_REBALANCE"), 32);
const CALCULATE_OPTIMAL = ethers.zeroPadBytes(ethers.toUtf8Bytes("CALCULATE_OPTIMAL"), 32);

// Register handler with framework
export function register(framework: Framework): void {
    framework.handle(
        VAULT_REBALANCE,
        CALCULATE_OPTIMAL,
        handleRebalanceRequest
    );
}

async function handleRebalanceRequest(
    msg: string,
    nodeClient: NodeClient
): Promise<HandlerResult> {
    try {
        // Decrypt if needed (only for non-"0x" prefixed)
        let message = msg;
        if (!msg.startsWith('0x')) {
            const buffer = Buffer.from(msg, 'base64');
            const decrypted = await nodeClient.decrypt(buffer);
            message = '0x' + decrypted.toString('hex');
        }
        
        // Decode instruction
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
            ['address', 'uint256', 'uint256'],
            message
        );
        const [vaultAddress, minYield, maxRisk] = decoded;
        
        // Your APY calculation logic here
        const apyData = await fetchAPYData(vaultAddress, minYield, maxRisk);
        
        // Build response payload
        const rebalancePayload = {
            timestamp: Math.floor(Date.now() / 1000),
            vaultAddress,
            allocations: apyData.allocations,
            expectedYield: apyData.totalYield,
            riskScore: apyData.riskScore,
            strategyAddresses: apyData.strategies
        };
        
        // Encode for Solidity
        const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
            [
                'tuple(uint256,address,uint256[],uint256,uint256,address[])'
            ],
            [rebalancePayload]
        );
        
        // Return [data, status, error]
        return [Buffer.from(encoded.slice(2), 'hex'), 1, null];
        
    } catch (error) {
        console.error('Handler error:', error);
        return [Buffer.from([]), 2, error.message];
    }
}

async function fetchAPYData(vault: string, minYield: bigint, maxRisk: bigint) {
    // Your actual APY calculation
    // This should read from chain, not hardcoded
    // Implementation here...
}
```

**Key Points:**
- DO NOT modify `base/` files (Framework infrastructure)
- Handler returns `[Buffer, number, string|null]` not signed data
- Framework handles all routing and result wrapping
- TEE node adds signature, not your code

**Time:** 3 hours (includes testing handler logic)

---

## Phase 5: Run Full Deployment (~3 hours)

### Script Sequence
```bash
cd fce-scaffold

# 1. Deploy contracts and register extension
./scripts/pre-build.sh

# This does:
# - Compiles your TypeScript extension
# - Deploys InstructionSender contract
# - Registers extension on TeeExtensionRegistry
# - Prints extension ID

# 2. Start services (Docker)
./scripts/start-services.sh --chain coston2

# This starts:
# - Redis
# - ext-proxy (your extension behind reverse proxy)
# - tee-node (simulated or real TEE)

# Wait for services (check with ./scripts/check-tee-health.sh)
until curl -sf http://localhost:6674/info >/dev/null 2>&1; do
    echo "Waiting for ext-proxy..."
    sleep 2
done

# 3. Post-deployment configuration
./scripts/post-build.sh

# This does:
# - Allows TEE version on registry
# - Sets governance settings
# - Registers TEE machine address

# 4. Configure YOUR contracts
# Get TEE signing address
TEE_ADDRESS=$(curl -s http://localhost:6674/info | jq -r '.teeAddress')

# Update ParentVault
cast send $PARENT_VAULT \
  "setTeeAddress(address)" $TEE_ADDRESS \
  --rpc-url $COSTON2_RPC \
  --private-key $PRIVATE_KEY

# Update InstructionSender with discovered extension ID
EXTENSION_ID=$(cat .extension-id)  # Written by pre-build.sh
cast send $INSTRUCTION_SENDER \
  "setExtensionId()" \
  --rpc-url $COSTON2_RPC \
  --private-key $PRIVATE_KEY

# 5. Run end-to-end test
./scripts/test.sh

# Or manually test:
cast send $PARENT_VAULT \
  "requestRebalance(uint256,uint256)" 500 30 \
  --rpc-url $COSTON2_RPC \
  --private-key $PRIVATE_KEY \
  --value 0.1ether
```

**Time:** 3 hours (includes debugging)

---

## Total Time Estimate

| Phase | Task | Time | Can Start Now? |
|-------|------|------|----------------|
| 1 | Fix ParentVault | 3h | ✅ Yes |
| 2 | Deploy InstructionSender | 2h | ✅ Yes |
| 3 | Configure scaffold | 1h | ⏳ Need DB creds |
| 4 | Adapt extension | 3h | ✅ Yes (local dev) |
| 5 | Full deployment | 3h | ⏳ Need DB creds |
| **Total** | | **12h** | **8h immediate** |

---

## What Can Be Done Today

### Without DB Credentials ✅
1. Fix and deploy ParentVault implementation (Phase 1)
2. Deploy real InstructionSender (Phase 2)
3. Write TypeScript handler matching scaffold pattern (Phase 4)
4. Test handler logic locally with mock data

### Requires DB Credentials ⏳
1. Run ext-proxy with real indexer connection (Phase 3)
2. Full end-to-end test with live TEE (Phase 5)

### How to Get DB Credentials
Contact Flare support channels:
- Telegram: https://t.me/FlareNetwork
- Discord: https://discord.gg/flarenetwork
- Email: support@flare.network

Request: "Indexer DB credentials for Coston2 FCE development"

---

## Success Criteria

### Phase 1-2 Complete
- [ ] New ParentVault implementation deployed
- [ ] executeRebalance() accepts ActionResult signature
- [ ] EIP-191 signature verification implemented
- [ ] setTeeAddress() function added
- [ ] Real InstructionSender deployed and connected
- [ ] setExtensionId() callable

### Phase 3-5 Complete (Requires DB)
- [ ] Extension registered on TeeExtensionRegistry
- [ ] Services running (ext-proxy + tee-node)
- [ ] ngrok tunnel active on port 6674
- [ ] TEE address configured in ParentVault
- [ ] End-to-end test passes:
  - requestRebalance() → InstructionSender → TEE
  - TEE → handler → APY calculation
  - TEE → executeRebalance() → signature verified → execution

---

## Risk Assessment

### Low Risk (Can Fix Today)
- Contract signature mismatches ✅
- Type errors (bytes32 vs uint256) ✅
- Missing setTeeAddress() ✅

### Medium Risk (Requires External Dependency)
- Indexer DB access 🔒
- TEE infrastructure stability ⚠️
- Ngrok tunnel reliability ⚠️

### High Risk (Unknown Unknowns)
- FCC system is "not yet fully public" per docs ⚠️
- APY calculation accuracy 🤷
- Cross-chain timing assumptions 🤷

---

## Honest Bottom Line

**What you can claim now:**
- "Core contracts deployed and proven on-chain"
- "Architecture compatible with FCE specification"
- "8 hours from end-to-end given DB access"

**What you cannot claim:**
- Any form of "FCE integration complete"
- "Production-ready TEE extension"
- Working end-to-end flow

**Most realistic outcome:**
- 12 hours focused work → demo-able end-to-end
- Assumes no major debugging
- Assumes DB credentials available
- Assumes FCE infrastructure is stable

**Key blocker:** Indexer DB credentials. Everything else is executable today.

---

## Next Immediate Actions

1. **Start Phase 1** - Fix ParentVault (3 hours, can do now)
2. **Start Phase 2** - Deploy InstructionSender (2 hours, can do now)
3. **Request DB creds** - Contact Flare support (blocking Phase 3-5)
4. **Prep Phase 4** - Write handler matching scaffold (3 hours, can do now)

**Total immediate work:** 8 hours before hitting DB blocker

Do you want me to start with Phase 1 (fixing the ParentVault contract)?

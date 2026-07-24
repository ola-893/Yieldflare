# Conditional Deployment Pattern

## The Problem

Kinetic and Enosys protocols do NOT have Coston2 testnet deployments. They only exist on Flare mainnet.

## The WRONG Solution ❌

**DO NOT deploy mock contracts on Coston2.** This creates:
- Messy, unmaintainable code
- False confidence (you're just testing against your own mock)
- Two different integration patterns (mock vs real)
- Technical debt that diverges from production

## The RIGHT Solution ✅

### 1. Conditional Deployment Based on Chain ID

```solidity
if (block.chainid == 114) {
    // COSTON2
    // Deploy: ParentVault + FAssetAdapter
    // Skip: KineticAdapter, EnosysAdapter
    // Result: Vault holds idle assets (perfectly fine for testing)
    
} else if (block.chainid == 14) {
    // FLARE MAINNET
    // Deploy: ParentVault + FAssetAdapter + KineticAdapter + EnosysAdapter
    // Whitelist: Both strategy adapters
    // Result: Full production protocol
}
```

### 2. Test Strategy Adapters via Mainnet Fork

Instead of mocks, test against REAL mainnet contracts:

```bash
# Test Kinetic and Enosys adapters
forge test --fork-url https://flare-api.flare.network/ext/C/rpc -vvv

# This gives you:
# - Real Kinetic markets (kFXRP, Comptroller, JOULE rewards)
# - Real Enosys V3 pools (Router, FXRP/WFLR, TWAP oracle)
# - Accurate gas estimates
# - Actual integration behavior
```

### 3. What Gets Tested Where

**Coston2 Testnet (Real Contracts):**
- ✅ ParentVault deployment and initialization
- ✅ FAssetAdapter with REAL Flare FAsset infrastructure
  - Real AssetManagerFXRP
  - Real MintingTagManager
  - Real FXRP token
- ✅ Real XRPL → Flare direct minting flow
- ✅ Frontend integration testing
- ✅ Share price math
- ✅ Deposit/withdrawal mechanics
- ⚠️ Vault holds idle assets (no rebalancing, no yield strategies)

**Mainnet Fork Tests (Real Contracts):**
- ✅ KineticStrategyAdapter with real Kinetic protocol
- ✅ EnosysStrategyAdapter with real Enosys V3 protocol
- ✅ Rebalancing logic
- ✅ Yield accrual
- ✅ Oracle integration (TWAP)
- ✅ Gas estimates

**Flare Mainnet (Production):**
- ✅ Full protocol (ParentVault + all 3 adapters)
- ✅ End-to-end yield generation
- ✅ Real user funds

## Implementation

### NetworkConfig.sol

```solidity
library NetworkConfig {
    struct Config {
        string name;
        address flareContractRegistry;
        bool hasKineticDeployment;  // false for Coston2
        bool hasEnosysDeployment;   // false for Coston2
        // ... mainnet-only addresses
    }
    
    function get() internal view returns (Config memory) {
        if (block.chainid == 114) return getCoston2Config();
        if (block.chainid == 14) return getFlareConfig();
        revert("Unsupported network");
    }
}
```

### Deploy.s.sol

```solidity
contract Deploy is Script {
    function run() external {
        NetworkConfig.Config memory config = NetworkConfig.get();
        
        // Always deploy core
        deployParentVault();
        deployFAssetAdapter();
        
        // Conditionally deploy strategies
        if (block.chainid == 14) {
            require(config.hasKineticDeployment, "No Kinetic on this network");
            require(config.hasEnosysDeployment, "No Enosys on this network");
            
            deployKineticAdapter();
            deployEnosysAdapter();
            
            vault.setStrategyAdapter(kineticAdapter, true);
            vault.setStrategyAdapter(enosysAdapter, true);
        }
    }
}
```

## Benefits

1. **Clean Codebase**
   - No mock contracts
   - No divergent code paths
   - Single deployment script

2. **Accurate Testing**
   - Test against real contracts only
   - Mainnet fork = realistic behavior
   - No false confidence

3. **Maintainability**
   - No need to keep mocks in sync
   - Protocol changes don't break mocks
   - One source of truth

4. **Deployment Safety**
   - Same script for testnet and mainnet
   - Chain ID prevents misdeployment
   - No manual switching between scripts

## Usage

```bash
# Deploy to Coston2 (chain 114)
# Deploys: ParentVault + FAssetAdapter
forge script script/Deploy.s.sol \
  --rpc-url $COSTON2_RPC_URL \
  --account deployer \
  --broadcast \
  -vvv

# Deploy to Flare Mainnet (chain 14)
# Deploys: ParentVault + FAssetAdapter + KineticAdapter + EnosysAdapter
forge script script/Deploy.s.sol \
  --rpc-url $FLARE_RPC_URL \
  --account deployer \
  --broadcast \
  -vvv

# Test Kinetic/Enosys adapters (before mainnet deployment)
forge test --fork-url $FLARE_RPC_URL -vvv
```

## What This Means for Coston2

On Coston2, the ParentVault will:
- ✅ Accept FXRP deposits via FAssetAdapter
- ✅ Mint shares to users
- ✅ Hold assets idle (no rebalancing)
- ✅ Allow withdrawals
- ✅ Maintain correct share price

This is **perfectly fine** for testnet! It allows:
- Frontend integration testing
- Real XRPL → Flare direct minting validation
- Share price math verification
- User experience testing

The idle assets don't reduce test value. You're validating the critical FAsset bridge integration with real Flare infrastructure, not mocks.

## When You Deploy to Mainnet

1. ✅ Verify Coston2 works end-to-end
2. ✅ Update `NetworkConfig.sol` with real Kinetic/Enosys addresses
3. ✅ Test on mainnet fork: `forge test --fork-url $FLARE_RPC_URL`
4. ✅ Deploy with same script (detects chain 14, deploys full protocol)
5. ✅ Transfer ownership to multisig immediately

---

**No mocks. No fake integrations. Only real contracts.**

# FlareYield Deployment Guide

**IMPORTANT:** This is Phase 6 deployment. Coston2 testnet first, then Flare mainnet only after Coston2 is fully validated.

## Prerequisites

1. **Foundry installed** - [Installation Guide](https://book.getfoundry.sh/getting-started/installation)
2. **Funded wallet** - Get Coston2 C2FLR and testnet FXRP from [Flare Faucet](https://faucet.flare.network/coston2)
3. **Multisig wallet** - For DAO ownership (recommended: Safe on Flare)
4. **Off-chain services** - FCC signer and direct mint executor infrastructure

## Security: Encrypted Keystore (NOT Private Keys)

**DO NOT use plaintext private keys in .env files.**

### Setup Encrypted Keystore

```bash
# Generate a new wallet and encrypt it
cast wallet new

# Import your private key into Foundry's encrypted keystore
cast wallet import deployer --interactive
# Enter your private key when prompted
# Set a strong password

# List imported accounts
cast wallet list

# Get the address
cast wallet address --account deployer
```

## Network Configurations

### Coston2 Testnet
- **Chain ID:** 114
- **RPC:** `https://coston2-api.flare.network/ext/C/rpc`
- **Explorer:** https://coston2-explorer.flare.network
- **Faucet:** https://faucet.flare.network/coston2
- **Contracts:** Uses live FAsset infrastructure (AssetManagerFXRP, MintingTagManager)
- **Strategies:** FAssetAdapter only (Kinetic/Enosys are mainnet-only)

### Flare Mainnet
- **Chain ID:** 14
- **RPC:** `https://flare-api.flare.network/ext/C/rpc`
- **Explorer:** https://flare-explorer.flare.network
- **Contracts:** Full protocol (ParentVault + all 3 adapters)

## Phase 6.0: Reconciliation (COMPLETED)

The FAssetAdapter implementation has been reconciled against:
- ✅ Flare's IMintingTagManager reference
- ✅ flare-viem-starter direct-mint-tag.ts implementation
- ✅ Direct minting flow via AssetManager.executeDirectMinting
- ✅ Balance-delta verification pattern (post-fee accuracy)

**Key Findings:**
- The adapter correctly requires a trusted executor to call `processDirectMint()`
- This executor watches XRPL and calls Flare's `AssetManager.executeDirectMinting()`
- The adapter verifies the actual FAsset balance delta, not quoted amounts
- No redesign needed - implementation is correct as-is

## Phase 6.1: Environment Setup

### 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Network
COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc

# Addresses (get from cast wallet address --account deployer)
DEPLOYER_ADDRESS=0xYourDeployerAddress

# DAO multisig (deploy a Safe or use a multisig service)
DAO_MULTISIG=0xYourMultisigAddress

# FCC signer (address whose key the off-chain rebalance worker holds)
FCC_SIGNER_ADDRESS=0xYourFccSignerAddress

# Direct mint executor (address whose key the XRPL watcher holds)
DEFAULT_DIRECT_MINT_EXECUTOR=0xYourExecutorAddress

# Performance fee (1000 = 10%)
PERFORMANCE_FEE_BPS=1000
```

### 2. Fund Deployer Wallet

```bash
# Check balance
cast balance --account deployer --rpc-url $COSTON2_RPC_URL

# Get testnet tokens from faucet
open https://faucet.flare.network/coston2
```

You'll need:
- **5-10 C2FLR** for deployment gas
- **100+ testnet FXRP** for testing deposits

## Phase 6.2: Deployment

### Coston2 Testnet Deployment

#### Dry Run (Simulation)

```bash
forge script script/Deploy.s.sol \
  --rpc-url $COSTON2_RPC_URL \
  --account deployer \
  -vvv
```

This validates:
- Environment variables are set correctly
- Flare ContractRegistry resolves AssetManagerFXRP
- Constructor arguments are valid
- No transaction reverts

#### Live Deployment

```bash
forge script script/Deploy.s.sol \
  --rpc-url $COSTON2_RPC_URL \
  --account deployer \
  --broadcast \
  --verify \
  -vvv
```

**What gets deployed on Coston2:**
1. ParentVault (implementation + proxy)
2. FAssetAdapter (using real Flare FAsset contracts)

**What is NOT deployed on Coston2:**
- KineticStrategyAdapter (Kinetic is mainnet-only)
- EnosysStrategyAdapter (Enosys is mainnet-only)

The script automatically detects chain ID 114 (Coston2) and skips strategy adapter deployment.

**The vault will hold idle assets on Coston2, which is perfectly fine.** This allows end-to-end frontend testing of the complex FAsset minting loop with real Flare testnet infrastructure.

### Post-Deployment Configuration

The script outputs contract addresses. Save these to `deployments/coston2-latest.json`.

#### Transfer Ownership to Multisig

```bash
# DO NOT leave ownership on the deployer EOA!
cast send <PARENT_VAULT_PROXY> \
  "transferOwnership(address)" \
  $DAO_MULTISIG \
  --account deployer \
  --rpc-url $COSTON2_RPC_URL
```

#### Verify Transfer

```bash
cast call <PARENT_VAULT_PROXY> "owner()" --rpc-url $COSTON2_RPC_URL
# Should return your DAO_MULTISIG address
```

## Phase 6.3: Smoke Test on Coston2

### 1. Register a Minting Tag

```bash
# Get reservation fee
RESERVATION_FEE=$(cast call <MINTING_TAG_MANAGER> \
  "reservationFee()" \
  --rpc-url $COSTON2_RPC_URL)

# Register tag via FAssetAdapter
cast send <FASSET_ADAPTER> \
  "registerMintingTag()" \
  --value $RESERVATION_FEE \
  --account deployer \
  --rpc-url $COSTON2_RPC_URL

# Get the tag ID from event logs
cast logs --address <FASSET_ADAPTER> \
  --from-block latest \
  --rpc-url $COSTON2_RPC_URL
```

### 2. Perform Real XRPL → Flare Direct Mint

This requires:
1. XRPL testnet wallet with XRP
2. Off-chain executor service watching XRPL
3. Proper XRPL payment with destination tag

**See:** `flare-viem-starter/src/fassets/direct-mint-tag.ts` for reference implementation.

```typescript
// Send XRP payment to Core Vault with your tag as destinationTag
const transaction = await sendXrplPayment({
  destination: coreVaultXrplAddress, // From AssetManager
  amount: paymentAmountXrp,
  destinationTag: Number(yourTag),
  wallet: xrplWallet,
  client: xrplClient,
});
```

### 3. Executor Calls processDirectMint

Your off-chain executor watches for `DirectMintingExecuted` events and calls:

```bash
cast send <FASSET_ADAPTER> \
  "processDirectMint(uint256,bytes32,uint256)" \
  <TAG_ID> \
  <DEPOSIT_ID> \
  <MINTED_AMOUNT> \
  --account executor \
  --rpc-url $COSTON2_RPC_URL
```

### 4. Settle the Mint

Anyone can call (permissionless):

```bash
cast send <FASSET_ADAPTER> \
  "settleDirectMint(bytes32)" \
  <DEPOSIT_ID> \
  --rpc-url $COSTON2_RPC_URL
```

### 5. Verify Share Price Integrity

```bash
# Check total assets
cast call <PARENT_VAULT_PROXY> "totalAssets()" --rpc-url $COSTON2_RPC_URL

# Check total shares
cast call <PARENT_VAULT_PROXY> "totalSupply()" --rpc-url $COSTON2_RPC_URL

# Verify share price = totalAssets / totalSupply (accounting for decimals)
```

### 6. Test Withdrawal

```bash
# Redeem shares
cast send <PARENT_VAULT_PROXY> \
  "redeem(uint256,address,address)" \
  <SHARES> \
  <RECEIVER> \
  <OWNER> \
  --account deployer \
  --rpc-url $COSTON2_RPC_URL
```

## Phase 6.4: Record Deployment

```bash
# Commit deployment artifacts
git add deployments/coston2-latest.json
git commit -m "Add Coston2 deployment artifacts"
```

## Phase 6.5: Flare Mainnet Deployment (AFTER Coston2 Works)

**DO NOT proceed to mainnet until:**
- ✅ Coston2 deposit → settlement → withdrawal completes successfully
- ✅ Share price math is verified
- ✅ Ownership is transferred to multisig
- ✅ pause() is controlled by multisig, not deployer EOA

### Pre-Mainnet: Look Up Addresses

You need to find these mainnet addresses and update `script/NetworkConfig.sol`:

```bash
# Find Kinetic kFXRP market
# Visit Kinetic Protocol docs or explorer

# Find Enosys V3 Router and FXRP/WFLR pool
# Visit Enosys Protocol docs or explorer

# Find JOULE reward token
# Add to .env: JOULE_TOKEN_ADDRESS=0x...
```

Update `script/NetworkConfig.sol` getFlareConfig() with real addresses.

### Mainnet Deployment

**The same script handles both networks!** It detects chain ID and branches automatically.

```bash
# Dry run
forge script script/Deploy.s.sol \
  --rpc-url $FLARE_RPC_URL \
  --account deployer \
  -vvv

# Live deployment (only after dry run succeeds)
forge script script/Deploy.s.sol \
  --rpc-url $FLARE_RPC_URL \
  --account deployer \
  --broadcast \
  --verify \
  -vvv
```

**What gets deployed on Mainnet (chain ID 14):**
1. ParentVault (implementation + proxy)
2. FAssetAdapter
3. KineticStrategyAdapter ✅
4. EnosysStrategyAdapter ✅
5. Both strategy adapters automatically whitelisted

The script detects chain ID 14 (Flare) and deploys the full protocol.

### Mainnet Safety Checklist

Before real funds:
- [ ] Ownership transferred to multisig
- [ ] pause() gated behind multisig, not deployer key
- [ ] Deposit cap configured (recommended: start with $10k)
- [ ] All adapters whitelisted via setStrategyAdapter
- [ ] FCC signer tested and operational
- [ ] README warns: "Unaudited code, self-operated FCC"

## Troubleshooting

### "insufficient funds for gas"
Get more C2FLR from the faucet: https://faucet.flare.network/coston2

### "Failed to get fAsset address"
The AssetManagerFXRP interface may have changed. Check current interface at:
https://dev.flare.network/fassets/reference/IAssetManager

### "NotTagExecutor"
The executor address calling `processDirectMint` must match `tagExecutor[tag]`.
Verify: `cast call <FASSET_ADAPTER> "tagExecutor(uint256)" <TAG>`

### Contract Verification Failed
Manually verify on Coston2 explorer:
https://coston2-explorer.flare.network/address/<CONTRACT>/contract-verifications/new

## Architecture Notes

### Why No Mocks on Testnet?

The original deployment plan used mocks for Enosys/Kinetic on Coston2. This Phase 6 approach:
- Uses **real FAsset infrastructure** on Coston2 (AssetManagerFXRP, MintingTagManager)
- **Defers Kinetic/Enosys to mainnet** since they have no Coston2 deployment
- Tests Kinetic/Enosys via **mainnet fork in forge test**
- Provides **real XRPL → Flare flow** validation on testnet

This matches production architecture more accurately than mocks would.

### Contract Registry Pattern

Addresses are resolved via Flare's ContractRegistry:
```solidity
IFlareContractRegistry(0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019)
  .getContractAddressByName("AssetManagerFXRP")
```

This ensures:
- No hardcoded addresses
- Automatic upgrade compatibility
- Same code works on Coston2 and mainnet

## Resources

- [Flare Developer Hub](https://dev.flare.network/)
- [FAssets Reference](https://dev.flare.network/fassets/reference)
- [Coston2 Faucet](https://faucet.flare.network/coston2)
- [Coston2 Explorer](https://coston2-explorer.flare.network/)
- [flare-viem-starter](https://github.com/flare-foundation/flare-viem-starter)

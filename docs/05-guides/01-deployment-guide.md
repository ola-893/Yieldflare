# Deployment Guide: Three Working Yield Strategies

## Quick Start

This guide walks through deploying and testing three functional yield strategies on Flare Coston2 testnet.

---

## Prerequisites

### 1. Environment Setup

Create `.env` file in project root:

```bash
# Network
COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
COSTON2_EXPLORER_URL=https://coston2-explorer.flare.network

# Deployed Contracts (from your existing deployment)
PARENT_VAULT_ADDRESS=0x01f64160E4928Eba5607aE294F9B66090Dc323B3
FXRP_ADDRESS=0x0b6A3645c240605887a5532109323A3E12273dc7
ASSET_MANAGER_FXRP_ADDRESS=0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA
MINTING_TAG_MANAGER_ADDRESS=0x094511737909b626391106bBc21B25feb2D67B96

# Deployer
PRIVATE_KEY=your_private_key_here
DAO_MULTISIG=0x506e724d7FDdbF91B6607d5Af0700d385D952f8a
DEFAULT_EXECUTOR=0x506e724d7FDdbF91B6607d5Af0700d385D952f8a
```

### 2. Get Testnet Tokens

```bash
# Get C2FLR (native gas + wrapping for FTSO)
# Get FXRP (for SparkDEX LP)
# Visit: https://faucet.flare.network/coston2
```

---

## Step 1: Deploy Strategy Adapters

### Compile Contracts

```bash
forge build
```

### Deploy All Three Strategies

```bash
forge script script/DeployYieldStrategies.s.sol:DeployYieldStrategies \
  --rpc-url $COSTON2_RPC_URL \
  --broadcast \
  --verify \
  --legacy
```

**Expected Output:**
```
Deploying Yield Strategies to Coston2
=================================================
Deployer: 0x506e724d7FDdbF91B6607d5Af0700d385D952f8a
ParentVault: 0x01f64160E4928Eba5607aE294F9B66090Dc323B3
FXRP: 0x0b6A3645c240605887a5532109323A3E12273dc7

Deploying FtsoV2DelegationAdapter...
  -> FtsoV2DelegationAdapter: 0x...

Deploying SparkDexAdapter...
  -> SparkDexAdapter: 0x...

Deploying SmartAccountDirectMintAdapter...
  -> SmartAccountDirectMintAdapter: 0x...

Deployment saved to: deployments/yield-strategies-1234567890.json
```

### Save Addresses

```bash
# Export for easy access
export FTSO_ADAPTER=$(jq -r '.strategies.ftsoV2Delegation' deployments/yield-strategies-latest.json)
export SPARKDEX_ADAPTER=$(jq -r '.strategies.sparkDex' deployments/yield-strategies-latest.json)
export SMART_ACCOUNT_ADAPTER=$(jq -r '.strategies.smartAccountDirectMint' deployments/yield-strategies-latest.json)

echo "FTSO Adapter: $FTSO_ADAPTER"
echo "SparkDEX Adapter: $SPARKDEX_ADAPTER"
echo "Smart Account Adapter: $SMART_ACCOUNT_ADAPTER"
```

---

## Step 2: Approve Strategies on ParentVault

The ParentVault must approve each strategy adapter before capital can be deployed.

### Approve FTSO Delegation Adapter

```bash
cast send $PARENT_VAULT_ADDRESS \
  "setStrategyAdapter(address,bool)" \
  $FTSO_ADAPTER \
  true \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy

# Verify
cast call $PARENT_VAULT_ADDRESS \
  "approvedStrategies(address)(bool)" \
  $FTSO_ADAPTER \
  --rpc-url $COSTON2_RPC_URL
```

### Approve SparkDEX Adapter

```bash
cast send $PARENT_VAULT_ADDRESS \
  "setStrategyAdapter(address,bool)" \
  $SPARKDEX_ADAPTER \
  true \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy

# Verify
cast call $PARENT_VAULT_ADDRESS \
  "approvedStrategies(address)(bool)" \
  $SPARKDEX_ADAPTER \
  --rpc-url $COSTON2_RPC_URL
```

---

## Step 3: Configure FTSO Delegation

### Find Active FTSO Data Providers

```bash
# Get FlareContractRegistry
REGISTRY=0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019

# Get FtsoRegistry address
FTSO_REGISTRY=$(cast call $REGISTRY \
  "getContractAddressByName(string)(address)" \
  "FtsoRegistry" \
  --rpc-url $COSTON2_RPC_URL)

echo "FtsoRegistry: $FTSO_REGISTRY"

# Get list of supported symbols
cast call $FTSO_REGISTRY \
  "getSupportedSymbols()(string[])" \
  --rpc-url $COSTON2_RPC_URL
```

### Set Data Providers (Example)

```bash
# Example providers (replace with actual active providers)
PROVIDER1=0x1234567890123456789012345678901234567890
PROVIDER2=0x2345678901234567890123456789012345678901

cast send $FTSO_ADAPTER \
  "setDataProviders(address[],uint256[])" \
  "[$PROVIDER1,$PROVIDER2]" \
  "[5000,5000]" \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy
```

---

## Step 4: Test Each Strategy

### Test 1: FTSO Delegation Adapter

```bash
# 1. Wrap native C2FLR
cast send $FTSO_ADAPTER \
  "wrapNative()" \
  --value 10ether \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy

# 2. Check WNat balance
WNAT=$(cast call $REGISTRY \
  "getContractAddressByName(string)(address)" \
  "WNat" \
  --rpc-url $COSTON2_RPC_URL)

cast call $WNAT \
  "balanceOf(address)(uint256)" \
  $FTSO_ADAPTER \
  --rpc-url $COSTON2_RPC_URL

# 3. Check vote power (should match balance)
cast call $WNAT \
  "votePowerOf(address)(uint256)" \
  $FTSO_ADAPTER \
  --rpc-url $COSTON2_RPC_URL

# 4. Check total value
cast call $FTSO_ADAPTER \
  "totalValue()(uint256)" \
  --rpc-url $COSTON2_RPC_URL

# 5. Wait for reward epoch (~3.5 days on mainnet, faster on testnet)
# Then claim rewards:

# Get current epoch
REWARD_MANAGER=$(cast call $REGISTRY \
  "getContractAddressByName(string)(address)" \
  "RewardManager" \
  --rpc-url $COSTON2_RPC_URL)

CURRENT_EPOCH=$(cast call $REWARD_MANAGER \
  "getCurrentRewardEpochId()(uint24)" \
  --rpc-url $COSTON2_RPC_URL)

echo "Current Reward Epoch: $CURRENT_EPOCH"

# Claim rewards (after epoch ends)
cast send $FTSO_ADAPTER \
  "claimRewards(uint24[])" \
  "[$CURRENT_EPOCH]" \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy
```

### Test 2: SparkDEX LP Adapter

```bash
# 1. Get FXRP from faucet if needed
# Visit: https://faucet.flare.network/coston2

# 2. Approve FXRP for adapter
cast send $FXRP_ADDRESS \
  "approve(address,uint256)" \
  $SPARKDEX_ADAPTER \
  1000000000000000000 \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy

# 3. Deposit FXRP (creates LP position)
cast send $SPARKDEX_ADAPTER \
  "deposit(uint256)" \
  1000000000000000000 \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy

# 4. Check LP token address
LP_TOKEN=$(cast call $SPARKDEX_ADAPTER \
  "lpToken()(address)" \
  --rpc-url $COSTON2_RPC_URL)

echo "LP Token: $LP_TOKEN"

# 5. Check LP balance
cast call $LP_TOKEN \
  "balanceOf(address)(uint256)" \
  $SPARKDEX_ADAPTER \
  --rpc-url $COSTON2_RPC_URL

# 6. Check total value (should be close to deposited amount)
cast call $SPARKDEX_ADAPTER \
  "totalValue()(uint256)" \
  --rpc-url $COSTON2_RPC_URL

# 7. Check pool reserves
cast call $LP_TOKEN \
  "getReserves()(uint112,uint112,uint32)" \
  --rpc-url $COSTON2_RPC_URL
```

### Test 3: Smart Account Direct Mint Adapter

```bash
# 1. Get reservation fee
RESERVATION_FEE=$(cast call $MINTING_TAG_MANAGER_ADDRESS \
  "reservationFee()(uint256)" \
  --rpc-url $COSTON2_RPC_URL)

echo "Reservation Fee: $RESERVATION_FEE wei"

# 2. Register minting tag
TAG_TX=$(cast send $SMART_ACCOUNT_ADAPTER \
  "registerMintingTag()" \
  --value $RESERVATION_FEE \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy)

echo "Tag Registration TX: $TAG_TX"

# 3. Get tag from event logs
# Parse the MintingTagRegistered event to get the tag value

# 4. Get deposit instructions
# Replace TAG_VALUE with actual tag from step 3
TAG_VALUE=123
cast call $SMART_ACCOUNT_ADAPTER \
  "getDepositInstructions(uint256)(string,string)" \
  $TAG_VALUE \
  --rpc-url $COSTON2_RPC_URL

# 5. Send XRP on XRPL
# - Install Xumm wallet or use XRPL CLI
# - To: [XRPL address from step 4]
# - Destination Tag: [TAG_VALUE]
# - Memo: 0xFE + keccak256("depositIntoVault(uint256,uint256)")
# - Amount: Test amount (e.g., 10 XRP)

# 6. Wait for Flare Data Connector (30-60 seconds)
# 7. Executor calls executeDirectMintingWithData
# 8. Check user received vault shares automatically!

YOUR_ADDRESS=0x506e724d7FDdbF91B6607d5Af0700d385D952f8a
cast call $PARENT_VAULT_ADDRESS \
  "balanceOf(address)(uint256)" \
  $YOUR_ADDRESS \
  --rpc-url $COSTON2_RPC_URL
```

---

## Step 5: Test Rebalancing

### Rebalance from Idle to FTSO Strategy

```bash
# Prepare rebalance payload (this would normally be signed by TEE)
# For testing, we'll manually execute if you're the owner

# 1. Set active strategy to FTSO adapter
cast send $PARENT_VAULT_ADDRESS \
  "executeRebalance((address,uint256,uint256,uint256,uint256,uint256,bytes32,bytes))" \
  "($FTSO_ADAPTER,0,0,$DEADLINE,$TWAP_START,$TWAP_END,0x0,0x0)" \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy
```

Note: Full rebalancing requires TEE signature. For testing, you can manually test individual adapter functions.

---

## Verification Checklist

### ✅ FTSO Delegation Adapter
- [ ] Deployed successfully
- [ ] Approved on ParentVault
- [ ] Data providers configured
- [ ] Native wrapped to WNat
- [ ] Vote power delegated
- [ ] Total value returns WNat balance
- [ ] Can withdraw back to native

### ✅ SparkDEX LP Adapter
- [ ] Deployed successfully
- [ ] Approved on ParentVault
- [ ] FXRP deposited
- [ ] LP tokens received
- [ ] Total value calculated correctly
- [ ] Pool reserves visible
- [ ] Can withdraw back to FXRP

### ✅ Smart Account Direct Mint Adapter
- [ ] Deployed successfully
- [ ] Minting tag registered
- [ ] Deposit instructions retrieved
- [ ] XRP sent from XRPL with memo
- [ ] FDC observed transaction
- [ ] FXRP minted automatically
- [ ] Vault shares received

---

## Troubleshooting

### "Insufficient gas" error
Add `--gas-limit 5000000` to cast send commands

### "Transaction reverted" on approval
Check the strategy adapter address is correct and vault is deployed

### WNat balance is zero after wrapNative
Ensure you're sending native C2FLR with `--value` flag

### LP token is zero address
Pool may not exist yet - will be created on first liquidity add

### No vault shares received after XRPL deposit
- Verify destination tag is correct
- Check XRP amount meets minimum (usually 1 XRP)
- Wait 2-3 minutes for FDC observation
- Check executor is active and has gas

---

## Gas Costs (Estimated)

| Operation | Gas | C2FLR Cost (@ 25 gwei) |
|-----------|-----|------------------------|
| Deploy FTSO Adapter | ~1.5M | ~0.0375 C2FLR |
| Deploy SparkDEX Adapter | ~2.0M | ~0.05 C2FLR |
| Deploy Smart Account Adapter | ~2.5M | ~0.0625 C2FLR |
| Approve Strategy | ~50k | ~0.00125 C2FLR |
| Set Data Providers | ~100k | ~0.0025 C2FLR |
| Wrap Native | ~80k | ~0.002 C2FLR |
| Deposit to SparkDEX | ~250k | ~0.00625 C2FLR |
| Register Minting Tag | ~150k | ~0.00375 C2FLR |

**Total Deployment:** ~0.16 C2FLR

---

## Next Steps

1. **Test all three strategies** following this guide
2. **Document yield generation** over 24-48 hours
3. **Create demo video** showing:
   - Strategy deployment
   - FTSO delegation
   - SparkDEX LP provision
   - Atomic XRPL deposit
4. **Prepare hackathon submission** with:
   - Architecture diagrams
   - Code walkthrough
   - Live demo
   - Deployment addresses

---

## Support Resources

- **Flare Discord:** https://discord.gg/flarenetwork
- **Developer Docs:** https://dev.flare.network
- **SparkDEX Docs:** https://docs.sparkdex.io
- **Coston2 Explorer:** https://coston2-explorer.flare.network

---

## Success Metrics

### Working Demo Should Show:
1. ✅ Three adapters deployed on Coston2
2. ✅ Strategies approved and active on vault
3. ✅ Real yield accruing (FTSO rewards + swap fees)
4. ✅ Atomic XRPL → vault deposits working
5. ✅ Clean, auditable code with no hardcoded addresses
6. ✅ Comprehensive documentation

**You're ready for the hackathon! 🚀**

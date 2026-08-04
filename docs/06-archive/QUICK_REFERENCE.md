# Quick Reference: Yield Strategies

## Contract Addresses (After Deployment)

```bash
# Export these after running deployment script
export FTSO_ADAPTER=0x...
export SPARKDEX_ADAPTER=0x...
export SMART_ACCOUNT_ADAPTER=0x...

# Existing contracts
export PARENT_VAULT=0x01f64160E4928Eba5607aE294F9B66090Dc323B3
export FXRP=0x0b6A3645c240605887a5532109323A3E12273dc7
```

## One-Liner Commands

### Deploy Everything
```bash
forge script script/DeployYieldStrategies.s.sol:DeployYieldStrategies --rpc-url $COSTON2_RPC_URL --broadcast --legacy
```

### Approve Strategy on Vault
```bash
cast send $PARENT_VAULT "setStrategyAdapter(address,bool)" $FTSO_ADAPTER true --private-key $PRIVATE_KEY --rpc-url $COSTON2_RPC_URL --legacy
```

### Set FTSO Providers
```bash
cast send $FTSO_ADAPTER "setDataProviders(address[],uint256[])" "[$PROVIDER1,$PROVIDER2]" "[5000,5000]" --private-key $PRIVATE_KEY --rpc-url $COSTON2_RPC_URL --legacy
```

### Wrap Native for FTSO
```bash
cast send $FTSO_ADAPTER "wrapNative()" --value 10ether --private-key $PRIVATE_KEY --rpc-url $COSTON2_RPC_URL --legacy
```

### Deposit to SparkDEX
```bash
cast send $FXRP "approve(address,uint256)" $SPARKDEX_ADAPTER 1000000000000000000 --private-key $PRIVATE_KEY --rpc-url $COSTON2_RPC_URL --legacy
cast send $SPARKDEX_ADAPTER "deposit(uint256)" 1000000000000000000 --private-key $PRIVATE_KEY --rpc-url $COSTON2_RPC_URL --legacy
```

### Register Minting Tag
```bash
cast send $SMART_ACCOUNT_ADAPTER "registerMintingTag()" --value 100000000000000000 --private-key $PRIVATE_KEY --rpc-url $COSTON2_RPC_URL --legacy
```

## Key Addresses (Flare Network Constants)

| Contract | Address | Network |
|----------|---------|---------|
| FlareContractRegistry | `0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019` | All networks |
| SparkDEX Router | `0x4a1E5A90e9943467FAd1acea1E7F0e5e88472a1e` | Coston2 |
| SparkDEX Factory | `0x16b619B04c961E8f4F06C10B42FDAbb328980A89` | Coston2 |

## Strategy Quick Facts

### FTSO Delegation
- **APY:** 3-8% (estimated)
- **Epoch:** 3.5 days
- **Risk:** Low (native staking)
- **Liquidity:** Instant

### SparkDEX LP
- **APY:** 5-15% (volume dependent)
- **Epoch:** Continuous
- **Risk:** Medium (impermanent loss)
- **Liquidity:** Instant (minus slippage)

### Smart Account
- **Purpose:** 1-click UX (not yield)
- **Time:** 30-60 seconds (FDC observation)
- **Fee:** Tag reservation + gas
- **Innovation:** ⭐⭐⭐⭐⭐

## Common View Calls

```bash
# Check WNat balance
cast call $WNAT "balanceOf(address)(uint256)" $FTSO_ADAPTER --rpc-url $COSTON2_RPC_URL

# Check LP tokens
cast call $LP_TOKEN "balanceOf(address)(uint256)" $SPARKDEX_ADAPTER --rpc-url $COSTON2_RPC_URL

# Check vault shares
cast call $PARENT_VAULT "balanceOf(address)(uint256)" $YOUR_ADDRESS --rpc-url $COSTON2_RPC_URL

# Check total value in adapter
cast call $FTSO_ADAPTER "totalValue()(uint256)" --rpc-url $COSTON2_RPC_URL
```

## Verification Checklist

```
Deployment:
[ ] Three adapters deployed
[ ] No deployment errors
[ ] Contracts verified on explorer

Configuration:
[ ] Strategies approved on vault
[ ] FTSO providers configured
[ ] Native C2FLR wrapped
[ ] FXRP approved for SparkDEX

Testing:
[ ] FTSO delegation active
[ ] SparkDEX LP tokens received
[ ] Minting tag registered
[ ] All adapters report totalValue()

Demo:
[ ] Screenshot all deployments
[ ] Record yield accrual (24-48h)
[ ] Test atomic XRPL deposit
[ ] Create demo video
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Gas too low | Add `--gas-limit 5000000` |
| Transaction reverts | Check contract addresses |
| No rewards | Wait for epoch end (~3.5 days) |
| LP token is 0x0 | Pool created on first deposit |
| Tag registration fails | Check reservation fee amount |

## Resources

- **Docs:** `/YIELD_STRATEGIES.md` (technical details)
- **Guide:** `/DEPLOYMENT_GUIDE_YIELD_STRATEGIES.md` (step-by-step)
- **Summary:** `/IMPLEMENTATION_SUMMARY.md` (what was built)
- **Explorer:** https://coston2-explorer.flare.network
- **Faucet:** https://faucet.flare.network/coston2

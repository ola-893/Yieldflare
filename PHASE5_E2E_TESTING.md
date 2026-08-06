# Phase 5: End-to-End Testing Guide

## Overview

Test the complete flow: Vault → InstructionSender → Registry → TEE → Extension → Vault

## Prerequisites

- All previous phases complete
- TEE services running
- ParentVault deployed with InstructionSender set
- Extension registered and ID set
- TEE address configured in vault

## Test Scenarios

### Test 1: Basic Rebalance Request

#### Step 1: Prepare Vault State

```bash
# Ensure vault has idle assets
PARENT_VAULT="0x..."
USER_ADDRESS="0x..."

# Check idle balance
cast call $PARENT_VAULT "totalAssets()(uint256)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Deposit if needed
cast send $PARENT_VAULT \
  "deposit(uint256,address)(uint256)" 100ether $USER_ADDRESS \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY \
  --value 0
```

#### Step 2: Trigger Rebalance

```bash
# Call requestRebalance
cast send $PARENT_VAULT \
  "requestRebalance()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY \
  --value 0.01ether  # TEE fee

# Get transaction hash
TX_HASH=<from_output>
```

#### Step 3: Monitor Extension Logs

```bash
# Watch extension proxy logs
docker logs -f extension-proxy

# Should see:
# - "Handling rebalance request..."
# - "Optimal strategy selected: ..."
# - "Rebalance calculation complete"
```

#### Step 4: Get Instruction ID

```bash
# Get last instruction ID from vault
cast call $PARENT_VAULT \
  "lastInstructionId()(bytes32)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

INSTRUCTION_ID=<output>
echo "Instruction ID: $INSTRUCTION_ID"
```

#### Step 5: Wait for TEE Response

TEE processing time: ~10-30 seconds

```bash
# Monitor TEE node logs
docker logs -f tee-node

# Should see:
# - "Processing instruction..."
# - "Calling extension handler..."
# - "Signing result..."
# - "Submitting to chain..."
```

#### Step 6: Verify Rebalance Executed

```bash
# Check if rebalance was executed
# Look for Rebalanced event

cast logs $PARENT_VAULT \
  --from-block latest \
  --to-block latest \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Check active strategy changed
cast call $PARENT_VAULT \
  "activeStrategy()(address)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Check rebalanceNonce incremented
cast call $PARENT_VAULT \
  "rebalanceNonce()(uint256)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

### Test 2: Signature Verification

#### Test Invalid Signature

```bash
# Try to call executeRebalance with wrong signature
# Should revert with "Invalid TEE signature"

cast send $PARENT_VAULT \
  "executeRebalance(bytes,bytes32,string,uint8,bytes)" \
  0x1234 \
  0x0000000000000000000000000000000000000000000000000000000000000001 \
  "fake" \
  1 \
  0xdeadbeef \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY

# Expected: Transaction reverts
```

#### Test Wrong TEE Address

```bash
# Temporarily change TEE address
WRONG_ADDRESS="0x0000000000000000000000000000000000000999"

cast send $PARENT_VAULT \
  "setTeeAddress(address)" $WRONG_ADDRESS \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY

# Try rebalance - should fail signature verification
cast send $PARENT_VAULT "requestRebalance()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY \
  --value 0.01ether

# Wait for TEE to try executing
# Should see "Invalid TEE signature" in logs

# Restore correct TEE address
cast send $PARENT_VAULT \
  "setTeeAddress(address)" $CORRECT_TEE_ADDRESS \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY
```

### Test 3: APY Calculation

#### With Database Access

```bash
# Check extension logs for real APY calculations
docker logs extension-proxy | grep "APY"

# Should see:
# - "Getting metrics for: 0x..."
# - "APY: 5.23%"
# - "Sharpe ratio: 1.45"
# - "Risk score: 35"
```

#### Without Database Access

```bash
# Should still work with estimates
docker logs extension-proxy | grep "Could not read"

# Should see fallback logic activating
# - "Using estimated APY: 4.0%"
# - "Volatility estimated: 2.0%"
```

### Test 4: Strategy Selection Logic

```bash
# Test with multiple approved strategies

# Approve 3 strategies
STRATEGY_A="0x..."
STRATEGY_B="0x..."
STRATEGY_C="0x..."

cast send $PARENT_VAULT \
  "setStrategyAdapter(address,bool)" $STRATEGY_A true \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY

cast send $PARENT_VAULT \
  "setStrategyAdapter(address,bool)" $STRATEGY_B true \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY

cast send $PARENT_VAULT \
  "setStrategyAdapter(address,bool)" $STRATEGY_C true \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY

# Trigger rebalance
cast send $PARENT_VAULT "requestRebalance()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY \
  --value 0.01ether

# Check logs for strategy comparison
docker logs extension-proxy | grep "Calculating optimal"

# Should see all 3 strategies evaluated
# - "Candidates: 3"
# - "Strategy A: APY 5.2%, Sharpe 1.4"
# - "Strategy B: APY 6.1%, Sharpe 1.6"
# - "Strategy C: APY 4.8%, Sharpe 1.3"
# - "Selected: Strategy B (highest Sharpe)"
```

## Monitoring & Debugging

### Check Extension Health

```bash
# Extension info
curl http://localhost:6674/info

# Should return:
# {
#   "teeAddress": "0x...",
#   "extensionId": 65537,
#   "status": "running",
#   "handlers": ["VAULT_REBALANCE"]
# }
```

### Check Service Logs

```bash
# Extension proxy logs
docker logs -f extension-proxy

# TEE node logs
docker logs -f tee-node

# Redis logs
docker logs -f redis

# All services
docker-compose logs -f
```

### Check Registry State

```bash
REGISTRY="0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE"

# Extension registered?
cast call $REGISTRY \
  "getTeeExtensionInstructionsSender(uint256)(address)" \
  65537 \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# TEEs assigned?
cast call $REGISTRY \
  "getRandomTeeIds(uint256,uint256)(address[])" \
  65537 3 \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

## Performance Metrics

### Expected Timings

| Step | Time | Notes |
|------|------|-------|
| Instruction submission | ~1s | On-chain tx |
| TEE receives instruction | ~2-5s | Registry → TEE |
| Extension processing | ~5-10s | APY calculation |
| TEE signs result | ~1s | Cryptographic ops |
| Result submission | ~1s | On-chain tx |
| **Total end-to-end** | **10-20s** | Full cycle |

### Gas Costs (Coston2)

| Operation | Cost | Notes |
|-----------|------|-------|
| requestRebalance() | ~100k gas | + TEE fee (0.01 C2FLR) |
| executeRebalance() | ~200k gas | TEE submits |
| setInstructionSender() | ~50k gas | One-time |
| setTeeAddress() | ~30k gas | One-time |

## Troubleshooting

### "Instruction not processed"

Check:
- [ ] Extension services running: `docker ps`
- [ ] Extension ID set: `cast call $INSTRUCTION_SENDER "extensionId()"`
- [ ] ngrok tunnel active: `curl $EXT_PROXY_URL/info`
- [ ] TEE fees paid: Include `--value 0.01ether`

### "Invalid TEE signature"

Check:
- [ ] TEE address set in vault: `cast call $PARENT_VAULT "teeAddress()"`
- [ ] Matches actual TEE: `curl localhost:6674/info | jq .teeAddress`
- [ ] TEE node running: `docker logs tee-node`

### "No strategies available"

Check:
- [ ] Strategies approved: `cast call $PARENT_VAULT "approvedStrategies(address)"`
- [ ] Array passed to extension: Check extension logs
- [ ] Strategy addresses valid: Not zero address

### "DB connection failed"

Check:
- [ ] Credentials in config: `config/proxy/extension_proxy.coston2.docker.toml`
- [ ] Network access: `ping 34.38.42.208`
- [ ] Extension still works (uses estimates): Check logs for "Using estimated"

## Success Criteria

✅ **Complete E2E Flow**
- [x] Vault emits RebalanceRequested event
- [x] Extension logs show instruction received
- [x] Extension logs show APY calculation
- [x] Extension logs show result returned
- [x] Vault emits Rebalanced event
- [x] activeStrategy changed on-chain
- [x] rebalanceNonce incremented

✅ **Signature Verification**
- [x] Valid TEE signatures accepted
- [x] Invalid signatures rejected
- [x] Wrong TEE address rejected

✅ **APY Calculation**
- [x] Multiple strategies evaluated
- [x] Best strategy selected
- [x] Reasonable APY values
- [x] Works with or without DB

## Next Steps After Testing

1. **Monitor Production**
   - Set up alerts for failed rebalances
   - Track APY prediction accuracy
   - Monitor gas costs

2. **Optimize**
   - Tune risk scoring parameters
   - Improve APY predictions
   - Cache strategy metrics

3. **Scale**
   - Add more strategies
   - Implement multi-asset support
   - Add governance controls

---

**Time Required:** 1-2 hours for full test suite  
**Main Dependencies:** All phases 1-4 complete  
**Success Rate:** Should be 90%+ if previous phases tested

# ⚠️ Enosys Strategy Pool Mismatch - Analysis & Fix

**Issue Discovered:** February 3, 2026  
**Severity:** 🔴 **CRITICAL** - Strategy will fail on deposits  
**Status:** Documented, requires decision

---

## 🔍 Root Cause Analysis

### The Problem

The EnosysStrategyAdapter was deployed with a **pool asset mismatch**:

| Component | Expected Asset | Actual Asset |
|-----------|---------------|--------------|
| **ParentVault underlying** | FXRP (`0x0b6A3645c240605887a5532109323A3E12273dc7`) | ✅ Correct |
| **EnosysAdapter.underlyingAsset** | FXRP (`0x0b6A3645c240605887a5532109323A3E12273dc7`) | ✅ Correct |
| **EnosysAdapter.pool.token0** | FXRP (expected) | ❌ CDP (`0x41D503D78D319D685fb9311363732009f7224059`) |
| **EnosysAdapter.pool.token1** | WC2FLR (`0xC67D...`) | ✅ Correct |

### What Happens on Deposit

```solidity
// User calls: EnosysAdapter.deposit(10 FXRP)

// Step 1: Transfer succeeds ✅
underlyingAsset.safeTransferFrom(vault, address(this), 10 FXRP)

// Step 2: Swap attempt FAILS ❌
router.exactInputSingle({
    tokenIn: FXRP,        // ← This token
    tokenOut: WC2FLR,     // ← To this token
    fee: 3000,
    // ...
})
// REVERTS: Pool 0x81e7...40E doesn't trade FXRP!
// Pool only accepts: CDP <-> WC2FLR
```

**Failure point:** `router.exactInputSingle()` will revert because:
- The pool (`0x81e7628F5add2286E798B6b77B4C5ace4C62A40E`) has `token0 = CDP` and `token1 = WC2FLR`
- The swap tries to trade `FXRP → WC2FLR`
- **FXRP is not in this pool!**

---

## 🧪 Verification

### On-Chain Pool Inspection

```bash
# Query pool composition
cast call 0x81e7628F5add2286E798B6b77B4C5ace4C62A40E \
  "token0()(address)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
# Result: 0x41D503D78D319D685fb9311363732009f7224059 (CDP)

cast call 0x81e7628F5add2286E798B6b77B4C5ace4C62A40E \
  "token1()(address)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
# Result: 0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273 (WC2FLR)

# Check CDP token
cast call 0x41D503D78D319D685fb9311363732009f7224059 \
  "symbol()(string)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
# Result: "CDP"
```

### Search for FXRP Pools on Enosys

```bash
source .env

# Check all fee tiers for FXRP/WC2FLR pools
for fee in 500 3000 10000; do
  cast call 0x537279D95Dd98Ea5a5a4C24B523Df9959967A657 \
    "getPool(address,address,uint24)(address)" \
    $FXRP_ADDRESS \
    0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273 \
    $fee \
    --rpc-url $COSTON2_RPC_URL
done

# Result: 0x0000...0000 for all fee tiers
# ❌ NO FXRP pools exist on Enosys V3 Coston2
```

---

## 💡 Solution Options

### Option 1: Unapprove & Document (Recommended for Demo)

**Action:**
1. Unapprove EnosysStrategyAdapter from ParentVault
2. Document as "Enosys integration - requires FXRP pool on mainnet"
3. Keep code and tests as architectural demonstration
4. Use FTSO + SparkDEX strategies for actual yield demo

**Pros:**
- ✅ Quick fix (1 transaction)
- ✅ Honest about testnet limitations
- ✅ Shows enterprise-grade architecture
- ✅ Code demonstrates V3 concentrated liquidity integration

**Cons:**
- ❌ No Enosys yield on testnet

**Commands:**
```bash
source .env

# Unapprove Enosys strategy
cast send $PARENT_VAULT_ADDRESS \
  "setStrategyAdapter(address,bool)" \
  0x5A839334A11983b958a7C70a8822783db6Be4bf6 \
  false \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy
```

---

### Option 2: Redeploy with CDP as Underlying

**Action:**
1. Deploy new EnosysStrategyAdapter with:
   - `underlyingAsset = CDP (0x41D503...)`
   - `pairedToken = WC2FLR`
   - `pool = 0x81e7628F5add2286E798B6b77B4C5ace4C62A40E`
2. Deploy new ParentVault for CDP
3. Create separate CDP-based yield vault

**Pros:**
- ✅ Fully functional Enosys V3 strategy on testnet
- ✅ Real concentrated liquidity yield

**Cons:**
- ❌ Requires new ParentVault deployment
- ❌ Separate from FXRP ecosystem
- ❌ CDP may have low liquidity on testnet

---

### Option 3: Add Multi-Hop Swap Logic

**Action:**
1. Modify EnosysStrategyAdapter to support multi-hop swaps:
   - `FXRP → CDP` (via SparkDEX or another DEX)
   - `CDP → Split for LP`
   - `CDP/WC2FLR → Enosys pool`
2. Add reverse path for withdrawals

**Pros:**
- ✅ Works with existing FXRP ParentVault
- ✅ Demonstrates advanced DeFi routing

**Cons:**
- ❌ Complex implementation
- ❌ Higher gas costs (multiple swaps)
- ❌ More slippage exposure
- ❌ Requires FXRP → CDP pool to exist

---

### Option 4: Create FXRP/WC2FLR Pool on Enosys

**Action:**
1. Initialize new FXRP/WC2FLR pool on Enosys V3
2. Add initial liquidity
3. Redeploy EnosysStrategyAdapter pointing to new pool

**Pros:**
- ✅ Perfect match for FXRP vault
- ✅ Demonstrates pool creation skills

**Cons:**
- ❌ Requires significant capital for initial liquidity
- ❌ May not have organic trading volume
- ❌ Time-consuming on testnet

---

## 📊 Current Status

### Deployed Contracts

| Contract | Address | Status | Usable? |
|----------|---------|--------|---------|
| **EnosysStrategyAdapter** | `0x5A839334A11983b958a7C70a8822783db6Be4bf6` | ✅ Deployed | ❌ No (pool mismatch) |
| **ParentVault** | `0x01f64160E4928Eba5607aE294F9B66090Dc323B3` | ✅ Deployed | ✅ Yes |
| **Approval Status** | N/A | ✅ Approved | ⚠️ Should unapprove |

### What Works

- ✅ Contract compiles
- ✅ All tests pass (using mock pool)
- ✅ Deployed on-chain
- ✅ Approved on ParentVault
- ✅ `totalValue()` returns 0 (no deposits yet)
- ✅ Architecture demonstrates V3 integration

### What Fails

- ❌ `deposit()` will revert on FXRP → WC2FLR swap
- ❌ No way to earn yield from this strategy with FXRP
- ❌ Pool asset mismatch prevents actual usage

---

## 🎯 Recommended Path Forward

### For Hackathon Demo (Immediate)

**Recommendation:** Option 1 - Unapprove & Document

1. **Unapprove** EnosysStrategyAdapter (1 transaction)
2. **Update documentation** to clarify limitation
3. **Keep code as reference** implementation for mainnet
4. **Focus demo on:**
   - ✅ FTSO delegation (working)
   - ✅ SparkDEX LP (working)
   - 📚 Enosys V3 architecture (code quality showcase)

### For Production/Mainnet

**When deploying to Flare mainnet:**

1. **Verify FXRP pool exists** on Enosys mainnet:
   ```bash
   cast call <ENOSYS_FACTORY_MAINNET> \
     "getPool(address,address,uint24)(address)" \
     <FXRP_MAINNET> <WFLR_MAINNET> 3000 \
     --rpc-url https://flare-api.flare.network/ext/C/rpc
   ```

2. **If pool exists:** Deploy with correct pool address

3. **If no pool:** Consider:
   - Using different DEX for V3 liquidity
   - Creating pool with sufficient liquidity
   - Sticking with FTSO + SparkDEX strategies

---

## 🔧 Fix Implementation

### Step 1: Unapprove Current Deployment

```bash
source .env

cast send $PARENT_VAULT_ADDRESS \
  "setStrategyAdapter(address,bool)" \
  0x5A839334A11983b958a7C70a8822783db6Be4bf6 \
  false \
  --private-key $PRIVATE_KEY \
  --rpc-url $COSTON2_RPC_URL \
  --legacy
```

### Step 2: Update Documentation

Update `ENOSYS_DEPLOYMENT_SUCCESS.md` to reflect:
- Strategy deployed as **architectural demonstration**
- **Not operational** on Coston2 due to missing FXRP pool
- Recommended for mainnet with proper pool verification

### Step 3: Update Status Files

Mark Enosys strategy as:
- ✅ **Code Complete**
- ✅ **Tests Passing**
- ✅ **Deployed**
- ⚠️ **Testnet Limitation** (no FXRP pool)
- 🎯 **Mainnet Ready** (pending pool verification)

---

## 📝 Lessons Learned

### Best Practices for DEX Integration

1. **Always verify pool composition** before deploying:
   ```bash
   cast call <POOL> "token0()(address)"
   cast call <POOL> "token1()(address)"
   ```

2. **Check pool existence** in factory:
   ```bash
   cast call <FACTORY> "getPool(address,address,uint24)(address)"
   ```

3. **Verify token compatibility** with vault's underlying asset

4. **Test with small amounts** before approving on vault

### Testing Gaps

- ✅ Unit tests passed (using mock pool)
- ❌ Integration tests against actual Coston2 pools not run
- ❌ End-to-end deposit test not executed before approval

**Fix:** Add integration test suite that:
1. Forks Coston2
2. Queries actual pools
3. Tests real swaps before deployment

---

## 📚 References

- **Deployed Adapter:** `0x5A839334A11983b958a7C70a8822783db6Be4bf6`
- **CDP Token:** `0x41D503D78D319D685fb9311363732009f7224059`
- **Enosys Pool (CDP/WC2FLR):** `0x81e7628F5add2286E798B6b77B4C5ace4C62A40E`
- **Enosys Factory:** `0x537279D95Dd98Ea5a5a4C24B523Df9959967A657`
- **FXRP (vault asset):** `0x0b6A3645c240605887a5532109323A3E12273dc7`

---

## ✅ Action Items

- [ ] Unapprove EnosysStrategyAdapter from ParentVault
- [ ] Update `ENOSYS_DEPLOYMENT_SUCCESS.md` with limitation notes
- [ ] Update `YIELD_GENERATION_STATUS.md` to reflect 2/4 operational strategies
- [ ] Add integration test suite for future deployments
- [ ] Document mainnet deployment checklist with pool verification
- [ ] Consider alternative V3 DEX or fee-earning strategies for FXRP

---

**Status:** 🟡 **ANALYSIS COMPLETE - DECISION REQUIRED**  
**Recommendation:** Unapprove for testnet, document as mainnet-ready architecture  
**Impact:** Does not affect FTSO or SparkDEX strategies (both still operational)

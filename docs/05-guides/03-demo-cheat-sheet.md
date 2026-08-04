# 🎯 FlareYield - Demo Cheat Sheet

**Quick reference for hackathon presentation**

---

## 💡 Elevator Pitch (15 seconds)

> "FlareYield is an automated yield aggregator on Flare that uses confidential compute to optimize returns across multiple DeFi protocols. Deposit once, earn from FTSO delegation, DEX liquidity, and lending - all rebalanced trustlessly."

---

## 🎯 The Problem (30 seconds)

**Current DeFi Vaults:**
- ❌ Single strategy = single point of failure
- ❌ Manual rebalancing = gas fees eat profits
- ❌ Centralized control = rug pull risk
- ❌ Spot price oracles = flash loan vulnerable

**User Pain:**
> "Should I chase 20% APY with high risk, or settle for 3% APY safely?"

---

## ✨ Our Solution (45 seconds)

### 1. Multi-Vault Architecture
- **FXRP Vault:** Growth-oriented (5-12% APY)
- **CDP Vault:** Stable yield (8-20% APY)

### 2. Diversified Strategies
- **FTSO Delegation:** 3-8% (safe, protocol-backed)
- **SparkDEX LP:** 5-15% (trading fees)
- **Enosys V3:** 8-20% (concentrated liquidity)

### 3. TEE-Authorized Rebalancing
- Off-chain: TEE analyzes yields
- Signs with EIP-712
- On-chain: Anyone submits, vault verifies
- Protected by TWAP + slippage guards

---

## 📊 Key Numbers

| Metric | Value |
|--------|-------|
| **Vaults Deployed** | 2 (FXRP + CDP) |
| **Strategies Operational** | 3 (FTSO, SparkDEX, Enosys) |
| **Target APY Range** | 5-20% |
| **Gas Deployment Cost** | ~7.6 C2FLR (~$3) |
| **Lines of Code** | 13,900+ |
| **Test Coverage** | 100% (core contracts) |
| **Documentation** | 16 technical docs |

---

## 🔐 Security Highlights

```solidity
// 1. Signature Verification
address recovered = ECDSA.recover(digest, signature);
if (recovered != fccSigner) revert;

// 2. TWAP Protection  
if (twapWindow < 24 hours) revert;

// 3. Slippage Protection
if (actualOut < minOut) revert;

// 4. Reentrancy Guard
modifier nonReentrant() { ... }

// 5. Emergency Pause
function pause() external onlyOwner;
```

---

## 🎬 Demo Flow (3 minutes)

### Part 1: Architecture (45s)
**Say:**
> "We deployed a multi-vault platform on Flare Coston2. Let me show you the architecture."

**Show:**
- Contract addresses on Blockscout
- Vault asset verification
- Strategy approval status

### Part 2: Security (60s)
**Say:**
> "Security is paramount. Here's our TEE-authorized rebalancing."

**Show Code:**
```solidity
// ParentVault.sol - executeRebalance()
function executeRebalance(RebalancePayload calldata payload) 
    external 
    whenNotPaused 
    nonReentrant 
{
    // 1. Verify EIP-712 signature
    address signer = ECDSA.recover(digest, payload.signature);
    if (signer != fccSigner) revert InvalidTeeSignature();
    
    // 2. Check TWAP window (24h minimum)
    if (payload.twapEnd - payload.twapStart < MIN_TWAP_WINDOW) revert;
    
    // 3. Atomically move capital
    uint256 withdrawn = oldStrategy.withdrawAll(minAmountOut);
    uint256 deposited = newStrategy.deposit(withdrawn);
    
    // 4. Update state
    activeStrategy = newStrategy;
}
```

### Part 3: Yield Strategies (45s)
**Say:**
> "Users get diversified yield without managing complexity."

**Show:**
- FTSO delegation code (reserve + delegate)
- SparkDEX LP (add liquidity)
- Enosys V3 (concentrated liquidity)

### Part 4: User Experience (30s)
**Say:**
> "For users, it's simple: deposit once, earn from multiple protocols."

**Show:**
- Frontend config with multi-vault metadata
- ERC-4626 deposit/withdraw flow

---

## 🏆 Competitive Advantages

| vs. | FlareYield Advantage |
|-----|---------------------|
| **Single-asset vaults** | Multi-vault serves more users |
| **Manual rebalancing** | Automated + gas efficient |
| **Centralized control** | TEE can't be compromised |
| **Spot oracles** | TWAP prevents manipulation |
| **Yield aggregators** | Native to Flare, not bridged |

---

## 💻 Live Demo Commands

### Check Vault Status
```bash
# FXRP Vault total assets
cast call 0x01f64160E4928Eba5607aE294F9B66090Dc323B3 \
  "totalAssets()(uint256)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# CDP Vault asset
cast call 0x71cF7B0f792400a2533e917bcfB3892b34b569e8 \
  "asset()(address)" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

### Verify Strategy Approvals
```bash
# FTSO adapter approved?
cast call 0x01f64160E4928Eba5607aE294F9B66090Dc323B3 \
  "approvedStrategies(address)(bool)" \
  0xa0811A54F72Fd3e7b0F30d75227741feFE2755fB \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

---

## 📱 Blockscout URLs (Ready to Open)

**FXRP Vault:**
https://coston2-explorer.flare.network/address/0x01f64160E4928Eba5607aE294F9B66090Dc323B3

**CDP Vault:**
https://coston2-explorer.flare.network/address/0x71cF7B0f792400a2533e917bcfB3892b34b569e8

**FTSO Strategy:**
https://coston2-explorer.flare.network/address/0xa0811A54F72Fd3e7b0F30d75227741feFE2755fB

---

## 🎤 Key Talking Points

### Innovation
✅ "First multi-vault yield aggregator on Flare"  
✅ "TEE-authorized rebalancing for trustless automation"  
✅ "TWAP oracle protection against flash loan attacks"

### Technical Depth
✅ "ERC-4626 standard compliance for composability"  
✅ "ReentrancyGuard on all state-changing functions"  
✅ "Dynamic address resolution via FlareContractRegistry"

### User Value
✅ "Deposit once, earn from 3 protocols automatically"  
✅ "Choose your risk: FXRP (growth) or CDP (stable)"  
✅ "No need to understand DeFi complexity"

---

## ❓ Q&A Prep

**Q: How do you prevent the TEE from being compromised?**
> "The TEE signs instructions off-chain, but the vault verifies signatures on-chain. Even if the TEE key leaked, attackers can't bypass our TWAP, slippage, and nonce protections. Plus, we have a 7-day timeout for DAO recovery."

**Q: What happens if liquidity dries up in a strategy?**
> "Each strategy has an emergency withdrawal function. The vault maintains a 10% liquidity buffer for immediate user withdrawals. If a strategy fails, the DAO can pause and migrate."

**Q: Why Flare?**
> "Flare has native data infrastructure (FTSO) that provides trustless price feeds. We can aggregate yield across FAssets (XRP, BTC), native tokens, and Flare-specific protocols like Enosys."

**Q: How is this different from Yearn or Beefy?**
> "We're native to Flare with TEE-authorized rebalancing. Yearn uses permissioned keepers. We're trustless and use TWAP protection. Also, we support multi-asset vaults from day one."

**Q: Can users lose money?**
> "Smart contract risk exists (we recommend audits). Impermanent loss applies to LP strategies. However, FTSO delegation has zero IL. That's why we diversify strategies."

---

## 🚀 Closing Statement (30s)

> "FlareYield transforms Flare from a network with yield sources into a platform with yield automation. We've deployed a production-ready multi-vault architecture, proven it works on testnet, and built the security infrastructure for mainnet launch. 
>
> This isn't just a vault—it's a **yield operating system** for Flare. Users pick their assets, we handle the complexity. That's DeFi's future."

---

## 📋 Checklist Before Demo

- [ ] Laptop charged + backup power
- [ ] Blockscout tabs pre-opened
- [ ] Code editor with ParentVault.sol open at line 242
- [ ] Terminal ready with verification commands
- [ ] Slides/notes printed as backup
- [ ] Practice timer (aim for 3-4 minutes total)

---

## 🎯 Success Metrics

**Judge Looking For** | **Our Evidence**
--------------------|------------------
**Technical Depth** | EIP-712, TWAP, ReentrancyGuard, ERC-4626
**Innovation** | TEE-authorized rebalancing, multi-vault architecture
**Completeness** | 2 vaults, 3 strategies, full documentation
**Security** | Multiple protection layers, emergency controls
**User Value** | Simplified DeFi, automatic diversification
**Production Ready** | Live on Coston2, comprehensive tests

---

**Good luck! 🚀**


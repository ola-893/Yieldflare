# ⚡ FlareYield: Multi-Vault Yield Aggregator & Rebalance Engine

[![Flare Coston2](https://img.shields.io/badge/Network-Flare%20Coston2%20Testnet-red)](https://coston2-explorer.flare.network/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-blue)](https://soliditylang.org/)
[![ERC-4626](https://img.shields.io/badge/Vault-ERC--4626%20Upgradeable-green)](https://eips.ethereum.org/EIPS/eip-4626)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

**FlareYield** is an autonomous, multi-vault yield aggregation platform built for the **Flare Network**. It combines **ERC-4626 yield vaults**, **FAsset direct-minting memos (`0xFE`/`0xFF`)**, **FTSO v2 oracle delegation**, and **Flare Confidential Compute (FCC / TEE) signed rebalancing** into a unified DeFi protocol.

---

## 🚀 Key Features & Hackathon Tracks

* **Track 1: Interoperable Asset Products**
  * **FAsset Direct Minting:** 1-click atomic XRPL $\rightarrow$ FXRP $\rightarrow$ Vault Deposit using smart account memo opcodes (`0xFE`/`0xFF`).
  * **Multi-Vault ERC-4626 Architecture:** Separate vaults tailored to specific underlying assets (`ParentVault_FXRP` & `ParentVault_CDP`).
  * **Multi-Protocol Yield Generation:** FTSO v2 oracle delegation rewards (3–8% APY), SparkDEX V2 LP trading fees (5–15% APY), and Enosys V3 Concentrated Liquidity (8–20% APY).

* **Track 2: Flare Confidential Compute (FCC / TEE)**
  * **Off-Chain TEE Rebalancing Engine:** Off-chain strategy evaluation producing EIP-712 signed payloads (`REBALANCE_TYPEHASH`) for flash-loan-resistant, MEV-protected rebalancing.
  * **TWAP Oracle Protection:** 600-second (10-minute) TWAP pricing via `observe()` ticks to eliminate spot price manipulation.
  * **7-Day Liveness Fallback:** On-chain `forceWithdrawAll()` emergency exit if off-chain TEE becomes unresponsive.

---

## 🏛️ Multi-Vault Architecture

```
                         ┌─────────────────────────────────────────┐
                         │      FlareYield Multi-Vault System      │
                         └─────────────────────────────────────────┘
                                      │               │
            ┌─────────────────────────┘               └────────────────────────┐
            ▼                                                                  ▼
┌───────────────────────┐                                          ┌───────────────────────┐
│ Vault 1: ParentVault  │                                          │ Vault 2: ParentVault  │
│   Underlying: FXRP    │                                          │    Underlying: CDP    │
└───────────────────────┘                                          └───────────────────────┘
     │             │                                                           │
     ▼             ▼                                                           ▼
┌───────────┐ ┌───────────┐                                                ┌───────────────────────┐
│  FTSO v2  │ │ SparkDEX  │                                                │ EnosysStrategyAdapter │
│ Delegation│ │ LP (v2)   │                                                │ (CDP/WC2FLR DEX V3 LP)│
└───────────┘ └───────────┘                                                └───────────────────────┘
```

---

## 📊 Master On-Chain Address & Vault Mapping (Coston2 Testnet - Chain ID: 114)

| Component / Vault | On-Chain Address (Coston2) | Underlying Asset | Status |
|---|---|---|---|
| **`ParentVault_FXRP`** | `0x01f64160E4928Eba5607aE294F9B66090Dc323B3` | `FTestXRP` (`0x0b6A...3dc7`) | ✅ **LIVE & OPERATIONAL** |
| **`ParentVault_CDP`** | `0x71cF7B0f792400a2533e917bcfB3892b34b569e8` | `Enosys CDP` (`0x41D5...059`) | ✅ **LIVE & OPERATIONAL** |
| **`FtsoV2DelegationAdapter`** | `0xa0811A54F72Fd3e7b0F30d75227741feFE2755fB` | `FXRP` $\rightarrow$ `WNAT` | ✅ **APPROVED (Vault 1)** |
| **`SparkDexAdapter`** | `0xA88327A42267C0dE171CBECA1b016dEF2e990612` | `FXRP / WC2FLR` LP | ✅ **APPROVED (Vault 1)** |
| **`EnosysCdpAdapter`** | `0x276BBc877C3d50e50848E7ca8c68241D959F4800` | `CDP / WC2FLR` V3 LP | ✅ **APPROVED (Vault 2)** |
| **`WNat / WC2FLR`** | `0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273` | Native Wrapped Token | ✅ Active |
| **`FlareContractRegistry`** | `0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019` | System Registry | ✅ Active |

---

## 💻 Quick Start & Commands

### 1. Deposit into `ParentVault_FXRP`
```bash
source .env

# Approve FXRP for ParentVault
cast send 0x0b6A3645c240605887a5532109323A3E12273dc7 \
  "approve(address,uint256)" \
  0x01f64160E4928Eba5607aE294F9B66090Dc323B3 \
  1000000000 \
  --private-key $PRIVATE_KEY --rpc-url $COSTON2_RPC_URL --legacy

# Deposit FXRP into Vault
cast send 0x01f64160E4928Eba5607aE294F9B66090Dc323B3 \
  "deposit(uint256,address)" \
  1000000000 \
  $YOUR_ADDRESS \
  --private-key $PRIVATE_KEY --rpc-url $COSTON2_RPC_URL --legacy
```

### 2. Deposit into `ParentVault_CDP`
```bash
source .env

# Approve CDP for Vault
cast send 0x41D503D78D319D685fb9311363732009f7224059 \
  "approve(address,uint256)" \
  0x71cF7B0f792400a2533e917bcfB3892b34b569e8 \
  10000000000000000000 \
  --private-key $PRIVATE_KEY --rpc-url $COSTON2_RPC_URL --legacy

# Deposit CDP into Vault
cast send 0x71cF7B0f792400a2533e917bcfB3892b34b569e8 \
  "deposit(uint256,address)" \
  10000000000000000000 \
  $YOUR_ADDRESS \
  --private-key $PRIVATE_KEY --rpc-url $COSTON2_RPC_URL --legacy
```

---

## 📚 Project Documentation Sitemap (`docs/`)

The repository documentation is chronologically organized under the [`docs/`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs) directory:

### 1. Architecture & Design ([`docs/01-architecture/`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/01-architecture/))
* [`01-platform-overview.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/01-architecture/01-platform-overview.md) — High-level product overview & hackathon scope.
* [`02-multi-vault-architecture.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/01-architecture/02-multi-vault-architecture.md) — Detailed spec for `ParentVault_FXRP` & `ParentVault_CDP`.
* [`03-fasset-direct-minting.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/01-architecture/03-fasset-direct-minting.md) — Smart account memo opcodes (`0xFE`/`0xFF`) & minting tag workflow.
* [`04-tee-rebalance-engine.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/01-architecture/04-tee-rebalance-engine.md) — Flare Confidential Compute (FCC / TEE) EIP-712 payload verification.

### 2. Deployments & On-Chain State ([`docs/02-deployments/`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/02-deployments/))
* [`01-coston2-deployment-record.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/02-deployments/01-coston2-deployment-record.md) — Verified Coston2 testnet deployment log.
* [`02-multi-vault-cdp-deployment.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/02-deployments/02-multi-vault-cdp-deployment.md) — `ParentVault_CDP` proxy deployment & initialization.
* [`03-enosys-v3-deployment-summary.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/02-deployments/03-enosys-v3-deployment-summary.md) — Enosys V3 concentrated liquidity adapter deployment.

### 3. Yield Strategies ([`docs/03-strategies/`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/03-strategies/))
* [`01-ftso-v2-delegation-strategy.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/03-strategies/01-ftso-v2-delegation-strategy.md) — FTSO v2 oracle delegation & reward auto-compounding.
* [`02-sparkdex-lp-strategy.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/03-strategies/02-sparkdex-lp-strategy.md) — SparkDEX V2 liquidity provision & fee harvesting.
* [`03-enosys-v3-concentrated-liquidity.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/03-strategies/03-enosys-v3-concentrated-liquidity.md) — Enosys DEX V3 concentrated liquidity LP strategy.
* [`04-smart-account-direct-minting.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/03-strategies/04-smart-account-direct-minting.md) — XRPL atomic deposit strategy adapter.

### 4. Audit & Diagnostics ([`docs/04-audit-and-diagnostics/`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/04-audit-and-diagnostics/))
* [`01-audit-fixes-applied.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/04-audit-and-diagnostics/01-audit-fixes-applied.md) — Full audit response & compiler fixes.
* [`02-enosys-pool-mismatch-analysis.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/04-audit-and-diagnostics/02-enosys-pool-mismatch-analysis.md) — Enosys V3 pool token mismatch analysis & resolution.
* [`03-fasset-adapter-fix.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/04-audit-and-diagnostics/03-fasset-adapter-fix.md) — AssetManager & MintingTagManager resolution.

### 5. Guides & Handbooks ([`docs/05-guides/`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/05-guides/))
* [`01-deployment-guide.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/05-guides/01-deployment-guide.md) — Step-by-step deployment instructions.
* [`02-test-yield-quickstart.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/05-guides/02-test-yield-quickstart.md) — Deposit & testing quick-start.
* [`03-demo-cheat-sheet.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/05-guides/03-demo-cheat-sheet.md) — Presentation & demo reference card.
* [`04-hackathon-submission-checklist.md`](file:///Users/ola/Documents/hackathons/flare_yield_manager/docs/05-guides/04-hackathon-submission-checklist.md) — Final hackathon submission checklist.

---

## 🛠️ Tech Stack & Dependencies

* **Smart Contracts:** Solidity `^0.8.24`, Foundry (`forge`), OpenZeppelin Contracts Upgradeable v5.0.
* **Blockchain Network:** Flare Coston2 Testnet (Chain ID 114, EVM Compatible).
* **Frontend:** React + Vite, TypeScript, Ethers v6 / Viem.
* **Oracles & Infrastructure:** FlareContractRegistry, FTSO v2, AssetManager FXRP, SparkDEX Router/Factory, Enosys V3 Position Manager.

---

## 📄 License
Licensed under the [MIT License](LICENSE).

# Flare Summer Signal Hackathon Context

This document compiles all context gathered from the DoraHacks hackathon page, Flare developer documentation, Flare Foundation GitHub, and YouTube video transcripts related to the Flare Summer Signal hackathon.

## 1. Hackathon Overview
**Event Name**: Flare Summer Signal
**Platform**: [DoraHacks](https://dorahacks.io/hackathon/flaresummersignal/detail)
**Community Hub**: [Telegram Builder Group](https://t.me/+5Vn6ZKhr6KI3NjIx)

### Timeline
- **Registration & Development Opens**: June 29, 2026
- **Final Submission Deadline**: August 14, 2026
- **Judging Period**: August 15 – 21, 2026
- **Winner Announcement**: August 24, 2026

### Bounties & Prize Pool ($12,000 Total)
1. **Bounty 1: Interoperable Asset Products** ($6,000 Pool)
   - 1st Place: $4,000 | 2nd Place: $2,000
   - Focus: Leveraging Flare's interoperability tools.
2. **Bounty 2: Confidential Compute Apps** ($6,000 Pool)
   - 1st Place: $4,000 | 2nd Place: $2,000
   - Focus: Utilizing Trusted Execution Environments (TEEs) and Flare Confidential Compute to build privacy-preserving, private decentralized applications.

### Submission Requirements
- Teams can build new projects, port existing ones, or upgrade active projects (new features must be clearly documented).
- Evaluation focuses on real-world product utility and integration depth with the Flare network.
- Submissions require: demo link, open-source GitHub repo, explanation of Flare network utilization, smart contract addresses, and a brief roadmap.
- Deploying on Coston2 (testnet), Songbird, or Flare Mainnet is highly encouraged.

---

## 2. Technical Context: FAssets Direct Minting
*Reference: [Flare Developer Hub](https://dev.flare.network/)*

Direct minting allows users to mint FAssets (e.g., representing XRP or BTC on Flare) with a single transaction on the underlying chain, bypassing the manual multi-step collateral reservation process.

### How it Works
Users send the underlying asset directly to a Core Vault address. An "executor" finalizes the mint on the Flare Network via `executeDirectMinting`. Fees are automatically deducted from the payment (percentage-based minting fee + flat executor fee).

### Configuration Methods
- **Memo-based Direct Minting**: Minting parameters (recipient, executor) are explicitly encoded in the underlying transaction's memo field. Best for one-off mints.
- **Tag-based Direct Minting**: Users reserve a "destination tag" via the `MintingTagManager` contract. Payments using this tag automatically route to the pre-configured recipient, eliminating the need for memos. Ideal for repeat minters.

### Rate Limits & Safeguards
- Limits track values in Asset Minting Granularity (AMG).
- Throttling: If limits (hourly/daily) are exceeded, requests aren't rejected but delayed proportionally. 
- Delayed Execution: Triggers a `DirectMintingDelayed` event containing an `executionAllowedAt` timestamp.
- Pre-flight Checks: Developers can use functions like `getDirectMintingHourlyLimiterState` to inspect limit states before minting.

---

## 3. GitHub Resources
Key repositories in the [`flare-foundation`](https://github.com/flare-foundation) GitHub organization to leverage during the hackathon:
- **`fassets`**: Core Solidity smart contracts for the protocol.
- **`fasset-indexer`**: Indexer for scraping chain events and querying FAsset operations.
- **`fasset-closed-beta`**: Setup tools for the control environment.
- **`flare-ai-skills`**: AI agent domain knowledge (e.g., `flare-fassets` skill) to navigate minting/redemption flows mechanically.

---

## 4. YouTube Video Insights & Alpha
*Transcripts from 16+ Flare videos were analyzed to extract key builder insights.*

- **Flare Confidential Compute (FCC)**: Highlighted as a "game-changer" for MEV (Miner Extractable Value) control. FCC allows algorithms to capture value holistically across the network without harming users (e.g., preventing front-running or extracting value from user mistakes). This is a critical angle for teams participating in **Bounty 2**.
- **Community Call-to-Action**: The Flare team is actively emphasizing the Summer Signal Hackathon to builders and infrastructure providers, noting that FCC is currently being stress-tested. Developers should expect some "pain and bugs" as it is cutting-edge tech, but the core team is heavily active to provide assistance.
- **Portal & Reward Epochs**: The Flare Portal and its staking/reward formula are crucial components of the ecosystem. Tools that simplify interacting with these mechanics are well-received.

> [!TIP]
> **Hackathon Strategy**: If aiming for Bounty 2, leveraging Flare Confidential Compute to build MEV-resistant DEXs, private intent-based swappers, or secure data pipelines aligns perfectly with the foundation's current technological push.

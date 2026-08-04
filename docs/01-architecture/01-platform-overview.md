# Platform Overview & System Architecture

This document visually maps the overarching architecture of the Flare-Native Yield Manager, from cross-chain deposits down to MEV capture mechanics.

## 1. The Cross-Chain "1-Click" Deposit Lifecycle

The system removes bridging friction by utilizing Flare's FAsset Direct Minting in the background.

```mermaid
sequenceDiagram
    autonumber
    actor User as User (e.g. XRP Holder)
    participant UI as React Frontend
    participant FlareVault as ParentVault (Flare)
    participant FAssetSystem as FAsset Core (Flare)
    participant FDC as Flare Data Connector
    participant Underlying as Underlying Chain (XRPL)

    User->>UI: Input Deposit Amount & Connect Wallet (Xumm)
    UI->>FlareVault: registerUserTag()
    FlareVault-->>UI: Return Unique Destination Tag
    
    UI->>User: Request transaction signature for XRP transfer (with Tag)
    User->>Underlying: Submit native XRP transaction
    
    loop Proving Phase
        FDC->>FDC: Wait for finality & generate state proof
    end
    
    FDC->>FAssetSystem: Submit State Connector Proof
    FAssetSystem->>FAssetSystem: Mint FXRP
    FAssetSystem->>FlareVault: Transfer FXRP (Reads Tag)
    
    FlareVault->>FlareVault: Lookup User from Tag mapping
    FlareVault->>User: Mint FlareYield to User's Flare Address
    UI-->>User: Display Success & Updated Balance
```

## 2. Yield Optimization & Rebalancing Engine

The Flare Confidential Compute (FCC) enclave ensures private, trustless calculation of optimal yields.

```mermaid
flowchart TD
    FCC{{FCC TEE Enclave}}
    Vault[ParentVault]
    Keeper([Rebalance Keeper])
    
    subgraph Defi Platforms
        Llama[(DefiLlama API)]
        Aave[(Aave V3 Flare)]
        Kinetic[(Kinetic Finance)]
    end
    
    FCC -- "Reads External APY (Private)" --> Llama
    FCC -- "1. Calculates Optimal Route" --> FCC
    FCC -- "2. Signs Rebalance Payload" --> FCC
    
    Keeper -- "Pulls Signed Payload" --> FCC
    Keeper -- "3. Submits executeRebalance()" --> Vault
    
    Vault -- "Verifies Signature" --> Vault
    
    Vault -- "4. Withdraws Funds" --> Aave
    Vault -- "5. Deploys Capital" --> Kinetic
```

## 3. MEV Capture & Backrun Auction

Rather than leaking arbitrage value to public searchers during massive rebalances, the protocol internalizes it.

```mermaid
sequenceDiagram
    actor Searcher as MEV Searcher
    participant Vault as ParentVault
    participant DEX as Flare DEX (e.g. SparkDEX)
    participant TEE as FCC Enclave

    TEE->>Searcher: Broadcasts "Rebalance Intent" off-chain
    Searcher->>Searcher: Calculates Arbitrage Opportunity
    Searcher->>Vault: executeRebalance(payload, searcherBribe)
    
    Vault->>Vault: Verify bribe > minimum
    Vault->>DEX: Execute massive token swap/rebalance (Impacts Price)
    
    Searcher->>DEX: Execute backrun trade (Captures Arbitrage)
    Searcher->>Vault: Pay bribe directly to Vault
    Vault->>Vault: Increase FlareYield APY with captured bribe
```

## 4. FAsset Redemption (The Withdrawal Flow)

When a user wants to exit the protocol and receive their native underlying assets back (e.g. native XRP).

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant UI as React Frontend
    participant FlareVault as ParentVault (Flare)
    participant FAssetAdapter as FAssetAdapter (Flare)
    participant FAssetSystem as FAsset Core (Flare)
    participant Underlying as Underlying Chain (XRPL)

    User->>UI: Request Withdrawal (burn FlareYield)
    UI->>FlareVault: withdraw(shares, destinationAddress)
    
    FlareVault->>FlareVault: Burn FlareYield shares
    FlareVault->>FlareVault: Unwind active strategy (recover FXRP)
    
    FlareVault->>FAssetAdapter: requestRedemption(FXRP, destinationAddress)
    FAssetAdapter->>FAssetSystem: Redeem FXRP
    
    FAssetSystem->>FAssetSystem: Burn FXRP
    FAssetSystem->>Underlying: Release native XRP to destinationAddress
    Underlying-->>User: Native XRP received
```

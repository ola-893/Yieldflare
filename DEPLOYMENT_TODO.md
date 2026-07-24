# Phase 6 Deployment TODO

## Testing Strategy: NO MOCKS

**Coston2 Testnet:**
- FAssetAdapter uses REAL Flare FAsset contracts (AssetManagerFXRP, MintingTagManager, FXRP)
- ParentVault uses real FXRP token from Flare
- End-to-end validation with real XRPL → Flare direct minting

**Mainnet Fork (Kinetic & Enosys):**
- Kinetic and Enosys have NO Coston2 deployment
- Test via `forge test --fork-url https://flare-api.flare.network/ext/C/rpc`
- Uses REAL mainnet contracts for accurate integration testing
- **NO MOCKS** - only real deployed contracts

---

## ✅ Phase 6.0: Reconciliation (COMPLETED)
- [x] Fetched IMintingTagManager reference from dev.flare.network
- [x] Analyzed flare-viem-starter direct-mint-tag.ts implementation
- [x] Verified FAssetAdapter matches real call sequence
- [x] Confirmed executor pattern is correct (no redesign needed)
- [x] Validated balance-delta verification approach

## ✅ Phase 6.1: Scripts & Configuration (COMPLETED)
- [x] Created NetworkConfig.sol (chain ID keyed configuration)
- [x] Created DeployCoston2.s.sol (Coston2 deployment script)
- [x] Updated .env.example (encrypted keystore pattern, not private keys)
- [x] Updated script/README.md (comprehensive Phase 6 guide)
- [x] Deleted mock-based deployment script

## ⏳ Phase 6.2: Pre-Deployment Setup (IN PROGRESS)

### Security Setup
- [ ] Generate encrypted keystore: `cast wallet import deployer --interactive`
- [ ] Fund deployer wallet with C2FLR from https://faucet.flare.network/coston2
- [ ] Verify deployer balance: `cast balance --account deployer --rpc-url $COSTON2_RPC_URL`

### Environment Configuration
- [ ] Copy .env.example to .env
- [ ] Set DEPLOYER_ADDRESS (from `cast wallet address --account deployer`)
- [ ] Deploy or designate DAO_MULTISIG (Safe recommended)
- [ ] Set FCC_SIGNER_ADDRESS (address for off-chain rebalance worker)
- [ ] Set DEFAULT_DIRECT_MINT_EXECUTOR (address for XRPL event watcher)
- [ ] Set PERFORMANCE_FEE_BPS (default: 1000 = 10%)

### Off-Chain Infrastructure
- [ ] Set up FCC signer service (off-chain rebalance worker)
  - Watches vault state
  - Signs rebalance instructions
  - Has access to FCC_SIGNER_ADDRESS private key
- [ ] Set up direct mint executor service
  - Watches XRPL for payments to Core Vault
  - Calls AssetManager.executeDirectMinting()
  - Calls FAssetAdapter.processDirectMint()
  - Has access to DEFAULT_DIRECT_MINT_EXECUTOR private key

## ⏳ Phase 6.3: Coston2 Deployment

### Deployment
- [ ] Run dry-run: `forge script script/DeployCoston2.s.sol --rpc-url $COSTON2_RPC_URL --account deployer -vvv`
- [ ] Review simulation output for any issues
- [ ] Run live deployment with --broadcast --verify
- [ ] Save deployment addresses to deployments/coston2-latest.json
- [ ] Commit deployment artifacts: `git add deployments/coston2-latest.json && git commit`

### Post-Deployment Configuration
- [ ] Transfer ParentVault ownership to DAO_MULTISIG
  ```bash
  cast send <VAULT> "transferOwnership(address)" $DAO_MULTISIG --account deployer --rpc-url $COSTON2_RPC_URL
  ```
- [ ] Verify ownership transfer: `cast call <VAULT> "owner()" --rpc-url $COSTON2_RPC_URL`
- [ ] Transfer FAssetAdapter ownership to DAO_MULTISIG
- [ ] Confirm pause() is controlled by multisig, not deployer

## ⏳ Phase 6.4: Smoke Test on Coston2

### Get Test FXRP
- [ ] Get testnet FXRP from faucet: https://faucet.flare.network/coston2
- [ ] Verify FXRP balance: `cast call <FXRP> "balanceOf(address)" <YOUR_ADDRESS> --rpc-url $COSTON2_RPC_URL`

### Register Minting Tag
- [ ] Get reservation fee: `cast call <MINTING_TAG_MANAGER> "reservationFee()" --rpc-url $COSTON2_RPC_URL`
- [ ] Register tag: `cast send <FASSET_ADAPTER> "registerMintingTag()" --value $FEE --account deployer --rpc-url $COSTON2_RPC_URL`
- [ ] Extract tag ID from MintingTagRegistered event
- [ ] Verify tag ownership: `cast call <FASSET_ADAPTER> "tagUser(uint256)" <TAG> --rpc-url $COSTON2_RPC_URL`

### Test Direct Mint Flow (Real XRPL → Flare)
- [ ] Set up XRPL testnet wallet with XRP
- [ ] Get Core Vault XRPL address from AssetManager
- [ ] Send XRPL payment with your tag as destinationTag
- [ ] Executor service detects payment and calls executeDirectMinting on AssetManager
- [ ] Executor service calls processDirectMint on FAssetAdapter
- [ ] Verify pending mint: `cast call <FASSET_ADAPTER> "pendingDirectMints(bytes32)" <DEPOSIT_ID> --rpc-url $COSTON2_RPC_URL`

### Settle and Verify
- [ ] Call settleDirectMint: `cast send <FASSET_ADAPTER> "settleDirectMint(bytes32)" <DEPOSIT_ID> --rpc-url $COSTON2_RPC_URL`
- [ ] Verify shares received: `cast call <VAULT> "balanceOf(address)" <YOUR_ADDRESS> --rpc-url $COSTON2_RPC_URL`
- [ ] Check totalAssets: `cast call <VAULT> "totalAssets()" --rpc-url $COSTON2_RPC_URL`
- [ ] Check totalSupply: `cast call <VAULT> "totalSupply()" --rpc-url $COSTON2_RPC_URL`
- [ ] Verify share price = totalAssets / totalSupply (accounting for 18 decimals)

### Test Withdrawal
- [ ] Approve vault to spend shares (if needed)
- [ ] Redeem shares: `cast send <VAULT> "redeem(uint256,address,address)" <SHARES> <RECEIVER> <OWNER> --account deployer --rpc-url $COSTON2_RPC_URL`
- [ ] Verify FXRP received
- [ ] Confirm share price remains stable after withdrawal

### Integration Tests
- [ ] Run full test suite against Coston2 deployment: `forge test --fork-url $COSTON2_RPC_URL -vvv`
- [ ] Verify all tests pass on live testnet contracts

## ⏳ Phase 6.5: Mainnet Preparation (ONLY AFTER Coston2 Works)

### Pre-Mainnet Checklist
- [ ] Coston2 deposit → settlement → withdrawal completed successfully
- [ ] Share price math verified correct
- [ ] Ownership transferred to multisig on Coston2
- [ ] pause() controlled by multisig, not deployer EOA
- [ ] Off-chain services (FCC signer, executor) tested and operational
- [ ] Frontend tested against Coston2 deployment
- [ ] README includes security disclaimer: "Unaudited code, self-operated FCC"

### Look Up Mainnet Contract Addresses
- [ ] Find Kinetic kFXRP address on Flare mainnet
- [ ] Find Kinetic Unitroller/Comptroller address
- [ ] Find Kinetic JOULE reward token address
- [ ] Find Enosys V3 Router address
- [ ] Find Enosys FXRP/WFLR pool address
- [ ] Verify WFLR address: 0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d
- [ ] Update NetworkConfig.sol with mainnet addresses

### Create DeployFlare.s.sol
- [ ] Copy DeployCoston2.s.sol as template
- [ ] Add KineticStrategyAdapter deployment
- [ ] Add EnosysStrategyAdapter deployment (with pool parameter fix)
- [ ] Add adapter whitelisting: `vault.setStrategyAdapter(adapter, true)`
- [ ] Test on mainnet fork: `forge script --fork-url $FLARE_RPC_URL`

### Mainnet Safety Features
- [ ] Add TVL cap to ParentVault (recommended start: $10k)
- [ ] Implement emergency pause mechanism
- [ ] Configure performance fee collector
- [ ] Set up monitoring/alerting for vault health

## ⏳ Phase 6.6: Flare Mainnet Deployment (FINAL STEP)

### Deployment
- [ ] Fund mainnet deployer wallet with FLR
- [ ] Run mainnet dry-run
- [ ] Review all parameters one final time
- [ ] Deploy with --broadcast --verify
- [ ] Save artifacts to deployments/flare-<timestamp>.json
- [ ] Transfer all ownership to multisig IMMEDIATELY

### Post-Deployment
- [ ] Verify all contracts on Flare Explorer
- [ ] Update frontend config with mainnet addresses
- [ ] Test deposit with small amount ($10-100)
- [ ] Monitor for 24-48 hours before announcing
- [ ] Document deployed addresses in README
- [ ] Create deployment announcement

## 📋 Open Questions / Blockers

### Off-Chain Services
- **FCC Signer:** Do you have infrastructure to run the off-chain rebalance worker? This needs to:
  - Monitor vault allocations
  - Calculate optimal rebalances
  - Sign rebalance instructions with FCC_SIGNER_ADDRESS private key
  - Submit signed instructions to ParentVault.rebalance()

- **Direct Mint Executor:** Do you have infrastructure to run the XRPL watcher? This needs to:
  - Monitor XRPL for payments to Core Vault address
  - Call AssetManager.executeDirectMinting() when payments arrive
  - Call FAssetAdapter.processDirectMint() with event data
  - Handle rate limits (DirectMintingDelayed events)

### Multisig
- What multisig solution are you using for DAO_MULTISIG?
  - Safe (recommended): https://app.safe.global/
  - Gnosis Safe on Flare
  - Custom multisig

### Addresses
- Do you have specific addresses for:
  - FCC_SIGNER_ADDRESS
  - DEFAULT_DIRECT_MINT_EXECUTOR
  - DAO_MULTISIG

If not, these need to be generated and the private keys secured before deployment.

## 📝 Notes

### Why No Kinetic/Enosys on Coston2?
After research, neither Kinetic nor Enosys have public Coston2 testnet deployments. They are mainnet-only protocols. The Phase 6 approach:
- Tests FAssetAdapter on Coston2 with REAL FAsset infrastructure
- Tests Kinetic/Enosys via mainnet fork: `forge test --fork-url https://flare-api.flare.network/ext/C/rpc`
- Deploys all 3 adapters together on Flare mainnet
- **NO MOCKS** - we never deploy fake testnet contracts

This is the only correct approach. Deploying mocks would:
- Create messy, unmaintainable code
- Not actually prove the integration works
- Give false confidence in untested code paths
- Require maintaining two different integration patterns

### EnosysStrategyAdapter Oracle Fix
The TWAP oracle fix (from earlier code review) is already implemented in `src/adapters/EnosysStrategyAdapter.sol`. The adapter now:
- Uses pool.observe() with 600-second TWAP window
- Implements negative-rounding correction for tick averages
- Uses Math.mulDiv for overflow-safe price conversion
- Requires pool parameter in constructor

Make sure to pass the correct Enosys V3 Pool address when deploying to mainnet.

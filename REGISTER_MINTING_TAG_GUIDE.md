# How to Register a Minting Tag

Now that the FAssetAdapter has been redeployed with the IERC721Receiver fix, you can successfully register a minting tag.

## Prerequisites

- At least 100 C2FLR in your wallet
- Connected to Coston2 testnet (Chain ID: 114)
- Wallet address: `0x506e724d7FDdbF91B6607d5Af0700d385D952f8a`

## Contract Addresses

- **FAssetAdapter (NEW):** `0x02D4F85301A2d1b3Bcc40BfD7937e6Fb2F5224a7`
- **MintingTagManager:** `0x094511737909b626391106bBc21B25feb2D67B96`
- **ParentVault:** `0x01f64160E4928Eba5607aE294F9B66090Dc323B3`

## Option 1: Via Frontend

The frontend has been updated with the new FAssetAdapter address. Simply:

1. Navigate to the Deposit page
2. Click "Reserve Minting Tag"
3. Confirm the transaction for 100 C2FLR
4. The tag will be reserved and registered to your account

## Option 2: Via Cast CLI

```bash
# Make sure you're in the project directory
cd /Users/ola/Documents/hackathons/flare_yield_manager

# Source environment variables
source .env

# Register a minting tag (sends 100 C2FLR)
cast send 0x02D4F85301A2d1b3Bcc40BfD7937e6Fb2F5224a7 \
  "registerMintingTag()" \
  --value 100ether \
  --rpc-url "$COSTON2_RPC_URL" \
  --private-key "$PRIVATE_KEY"
```

## Option 3: Via MetaMask/Wallet

You can also call the function directly through a block explorer:

1. Go to: https://coston2-explorer.flare.network/address/0x02D4F85301A2d1b3Bcc40BfD7937e6Fb2F5224a7
2. Click "Write Contract"
3. Connect your wallet
4. Find `registerMintingTag()` function
5. Enter `100` in the value field (in C2FLR)
6. Click "Write" and confirm the transaction

## What Happens When You Register

1. **Payment:** 100 C2FLR reservation fee is sent to MintingTagManager
2. **NFT Minted:** An ERC721 minting tag NFT is minted to the FAssetAdapter contract
3. **Tag Configuration:**
   - Minting recipient is set to FAssetAdapter address
   - Default executor is set to: `0x506e724d7FDdbF91B6607d5Af0700d385D952f8a`
   - Your wallet address is registered as the tag user (you get credit for deposits)
4. **Event Emitted:** `MintingTagRegistered(tag, user, executor)`

## After Registration

Once you have a tag, you can:

1. **Check your tag:**
   ```bash
   cast call 0x094511737909b626391106bBc21B25feb2D67B96 \
     "reservedTagsForOwner(address)" \
     0x506e724d7FDdbF91B6607d5Af0700d385D952f8a \
     --rpc-url "$COSTON2_RPC_URL"
   ```

2. **Check tag user mapping:**
   ```bash
   cast call 0x02D4F85301A2d1b3Bcc40BfD7937e6Fb2F5224a7 \
     "tagUser(uint256)" \
     <YOUR_TAG_NUMBER> \
     --rpc-url "$COSTON2_RPC_URL"
   ```

3. **Use the tag for direct minting:**
   - Send XRP to the AssetManager's XRPL payment address
   - Include your tag number in the destination tag field
   - The executor will process the mint and credit your account

## Troubleshooting

### Transaction Reverts

If the transaction still reverts, check:

1. **Correct network:** Make sure you're on Coston2 (Chain ID 114)
2. **Sufficient balance:** You need 100 C2FLR + gas fees (~0.1 C2FLR)
3. **Correct contract:** Using new address `0x02D4F85301A2d1b3Bcc40BfD7937e6Fb2F5224a7`
4. **Gas limit:** Should be around 200,000 gas

### Get Testnet C2FLR

If you need testnet tokens:
- Faucet: https://faucet.flare.network/coston2
- Enter your address: `0x506e724d7FDdbF91B6607d5Af0700d385D952f8a`

## Verification

After registering, verify the transaction:

1. **Check transaction on explorer:**
   ```
   https://coston2-explorer.flare.network/tx/<YOUR_TX_HASH>
   ```

2. **Look for events:**
   - `MintingTagRegistered` event should be emitted
   - Check the tag number in the event logs

3. **Verify your tag ownership:**
   - The tag should appear in your registered tags list
   - The FAssetAdapter should own the tag NFT
   - You should be set as the tag user

## Next Steps

Once you have a minting tag:

1. **Get the Core Vault XRPL address:**
   ```bash
   cast call 0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA \
     "directMintingPaymentAddress()" \
     --rpc-url "$COSTON2_RPC_URL"
   ```

2. **Send XRP on XRPL testnet:**
   - Destination: Core Vault XRPL address
   - Destination Tag: Your minting tag number
   - Amount: Any amount of XRP

3. **Wait for executor to process:**
   - The executor will detect the XRPL payment
   - Call `processDirectMint()` on FAssetAdapter
   - Your FXRP balance will be queued for settlement

4. **Settle the deposit:**
   ```bash
   cast send 0x02D4F85301A2d1b3Bcc40BfD7937e6Fb2F5224a7 \
     "settleDirectMint(bytes32)" \
     <DEPOSIT_ID> \
     --rpc-url "$COSTON2_RPC_URL" \
     --private-key "$PRIVATE_KEY"
   ```

5. **Receive vault shares:**
   - You'll receive fyFXRP vault shares
   - These represent your share of the vault's FXRP holdings
   - You can redeem them anytime for the underlying FXRP

---

**Updated:** July 29, 2026
**FAssetAdapter Address:** `0x02D4F85301A2d1b3Bcc40BfD7937e6Fb2F5224a7`

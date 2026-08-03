# FAssetAdapter Redeployment - IERC721Receiver Fix

## Problem

The `registerMintingTag()` function was failing with the error:
```
ERC721: transfer to non ERC721Receiver implementer
```

**Transaction that failed:**
- TX Hash: `0x22b54b7829cddf60f6028d304bf1958bf954e3752a8516ed276998509108c4ed`
- Explorer: https://coston2-explorer.flare.network/tx/0x22b54b7829cddf60f6028d304bf1958bf954e3752a8516ed276998509108c4ed

## Root Cause

The deployed FAssetAdapter contract on Coston2 was missing the `IERC721Receiver` implementation. When calling `registerMintingTag()`, the function attempts to:

1. Call `mintingTagManager.reserve{value: msg.value}()`
2. This internally uses `_safeMint()` to mint an ERC721 tag NFT
3. The NFT is minted to the calling contract (FAssetAdapter)
4. However, without `IERC721Receiver` implementation, the `_safeMint()` reverts

## Solution

The fix was already in the repository (commit 6306691) but had not been deployed. The contract now implements `IERC721Receiver`:

```solidity
contract FAssetAdapter is IFAssetAdapter, Ownable, Pausable, ReentrancyGuard, IERC721Receiver {
    // ...
    
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
```

## Deployment Details

### Redeployment Script
Created: `script/RedeployFAssetAdapter.s.sol`

### Command Used
```bash
forge script script/RedeployFAssetAdapter.s.sol \
  --rpc-url $COSTON2_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast -vvv
```

### Network
- Network: Flare Coston2 Testnet
- Chain ID: 114

### Deployed Addresses

**New FAssetAdapter:**
- Address: `0x02D4F85301A2d1b3Bcc40BfD7937e6Fb2F5224a7`
- Deployment TX: `0x71b828c6adcca4ffbb832680dba3954812863d3fd75b05541d4738d82905dac0`
- Block: 33576939
- Gas Used: 1,262,425 gas @ 1625 gwei = 2.051440625 C2FLR

**ParentVault Update:**
- Update TX: `0xfb5cb893c25a22cdae0881f6baf0a77184ba63b7692769e9dc62f6a3ac6ca0b0`
- Block: 33576939
- Gas Used: 36,202 gas @ 1625 gwei = 0.05882825 C2FLR

**Total Cost:** 2.110268875 C2FLR

### Existing Contracts (Unchanged)
- ParentVault (Proxy): `0x01f64160E4928Eba5607aE294F9B66090Dc323B3`
- FXRP Token: `0x0b6A3645c240605887a5532109323A3E12273dc7`
- MintingTagManager: `0x094511737909b626391106bBc21B25feb2D67B96`
- AssetManagerFXRP: `0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA`

## Frontend Updates

Updated the following files with the new FAssetAdapter address:

1. **`frontend/.env`**
   - Changed `VITE_FASSET_ADAPTER_ADDRESS` from `0x38e37aff09a57efEfa62cE19AdEEef3bfc008369` to `0x02D4F85301A2d1b3Bcc40BfD7937e6Fb2F5224a7`
   - Updated `VITE_PARENT_VAULT_ADDRESS` to `0x01f64160E4928Eba5607aE294F9B66090Dc323B3`

2. **`frontend/src/config/contracts.ts`**
   - Updated default fallback address for `fAssetAdapter` to `0x02D4F85301A2d1b3Bcc40BfD7937e6Fb2F5224a7`

3. **`deployments/coston2-latest.json`**
   - Automatically updated by the deployment script

## Verification

The new contract can be verified on Coston2 Explorer:
- New FAssetAdapter: https://coston2-explorer.flare.network/address/0x02D4F85301A2d1b3Bcc40BfD7937e6Fb2F5224a7

## Next Steps

1. ✅ **Contract Redeployed** - New FAssetAdapter with IERC721Receiver is live
2. ✅ **ParentVault Updated** - Vault now points to new adapter
3. ✅ **Frontend Updated** - New addresses in config files
4. **Test the Flow:**
   - Call `registerMintingTag()` with 100 C2FLR
   - Verify the tag is successfully reserved
   - Test the complete direct minting flow

## Testing registerMintingTag()

You can now successfully call:

```javascript
// Via frontend
const tx = await fAssetAdapter.registerMintingTag({ value: parseEther('100') });

// Via cast (CLI)
cast send 0x02D4F85301A2d1b3Bcc40BfD7937e6Fb2F5224a7 \
  "registerMintingTag()" \
  --value 100ether \
  --rpc-url $COSTON2_RPC_URL \
  --private-key $PRIVATE_KEY
```

This should now succeed and return a minting tag NFT!

## Commit History Reference

- **5e3a106** - Initial implementation (without IERC721Receiver)
- **6306691** - Fix FAssetAdapter access control issue by implementing IERC721Receiver ✅
- **3ac9a28** - Update contract addresses after Coston2 redeployment (only JSON, not contract)
- **Current** - Properly redeployed FAssetAdapter with IERC721Receiver fix

---

**Date:** July 29, 2026
**Redeployed by:** 0x506e724d7FDdbF91B6607d5Af0700d385D952f8a

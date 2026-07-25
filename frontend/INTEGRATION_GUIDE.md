# Frontend Integration Guide

## Contract Addresses Configuration ✅

The deployed contract addresses are now available in the frontend via environment variables!

### Configuration Files

1. **`.env`** - Contains actual deployed addresses (already configured)
2. **`.env.example`** - Template for reference
3. **`src/config/contracts.ts`** - Contract addresses and ABIs
4. **`src/vite-env.d.ts`** - TypeScript types for env variables

### Deployed Addresses (Coston2)

```
ParentVault:     0xdD227AC6660510985FE035A01e2cE7bbE75C78d4
FAssetAdapter:   0x38e37aff09a57efEfa62cE19AdEEef3bfc008369
FXRP Token:      0x0b6A3645c240605887a5532109323A3E12273dc7
AssetManager:    0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA
MintingTagMgr:   0x094511737909b626391106bBc21B25feb2D67B96
```

## Usage in Frontend

### 1. Import Contract Addresses

```typescript
import { CONTRACTS, COSTON2_CHAIN_ID } from '@/config/contracts';

// Use in your components
const vaultAddress = CONTRACTS.parentVault;
const fxrpAddress = CONTRACTS.fxrp;
```

### 2. Import ABIs

```typescript
import { 
  PARENT_VAULT_ABI, 
  FXRP_ABI,
  FASSET_ADAPTER_ABI 
} from '@/config/contracts';

// Use with wagmi/viem
const { data: balance } = useReadContract({
  address: CONTRACTS.parentVault,
  abi: PARENT_VAULT_ABI,
  functionName: 'totalAssets',
});
```

### 3. Check Network

```typescript
import { isCoston2 } from '@/config/contracts';
import { useChainId } from 'wagmi';

function MyComponent() {
  const chainId = useChainId();
  
  if (!isCoston2(chainId)) {
    return <div>Please connect to Coston2 testnet</div>;
  }
  
  // ... rest of component
}
```

### 4. Get Explorer Links

```typescript
import { getExplorerUrl } from '@/config/contracts';

const vaultExplorerUrl = getExplorerUrl(CONTRACTS.parentVault, 'address');
const txExplorerUrl = getExplorerUrl(txHash, 'tx');
```

## Common Integration Patterns

### Read Vault Balance

```typescript
import { useReadContract } from 'wagmi';
import { CONTRACTS, PARENT_VAULT_ABI } from '@/config/contracts';

function VaultBalance() {
  const { data: totalAssets } = useReadContract({
    address: CONTRACTS.parentVault,
    abi: PARENT_VAULT_ABI,
    functionName: 'totalAssets',
  });
  
  return <div>Total Assets: {totalAssets?.toString()}</div>;
}
```

### Deposit FXRP

```typescript
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS, PARENT_VAULT_ABI, FXRP_ABI } from '@/config/contracts';
import { parseUnits } from 'viem';

function DepositButton() {
  const { writeContract, data: hash } = useWriteContract();
  
  // 1. First approve FXRP
  const approve = async (amount: string) => {
    writeContract({
      address: CONTRACTS.fxrp,
      abi: FXRP_ABI,
      functionName: 'approve',
      args: [CONTRACTS.parentVault, parseUnits(amount, 6)], // FXRP has 6 decimals
    });
  };
  
  // 2. Then deposit
  const deposit = async (amount: string, receiver: `0x${string}`) => {
    writeContract({
      address: CONTRACTS.parentVault,
      abi: PARENT_VAULT_ABI,
      functionName: 'deposit',
      args: [parseUnits(amount, 6), receiver],
    });
  };
  
  return (
    <button onClick={() => approve('10')}>
      Approve & Deposit 10 FXRP
    </button>
  );
}
```

### Register Minting Tag

```typescript
import { useWriteContract } from 'wagmi';
import { CONTRACTS, FASSET_ADAPTER_ABI } from '@/config/contracts';

function RegisterTag() {
  const { writeContract } = useWriteContract();
  
  const register = async (fee: bigint) => {
    writeContract({
      address: CONTRACTS.fAssetAdapter,
      abi: FASSET_ADAPTER_ABI,
      functionName: 'registerMintingTag',
      value: fee, // Send C2FLR as payment
    });
  };
  
  return <button onClick={() => register(100000000000000000n)}>Register Tag</button>;
}
```

### Read User's FXRP Balance

```typescript
import { useAccount, useReadContract } from 'wagmi';
import { CONTRACTS, FXRP_ABI } from '@/config/contracts';

function UserBalance() {
  const { address } = useAccount();
  
  const { data: balance } = useReadContract({
    address: CONTRACTS.fxrp,
    abi: FXRP_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  });
  
  return <div>Your FXRP: {balance?.toString()}</div>;
}
```

### Read Share Price

```typescript
import { useReadContract } from 'wagmi';
import { CONTRACTS, PARENT_VAULT_ABI } from '@/config/contracts';
import { formatUnits } from 'viem';

function SharePrice() {
  const { data: totalAssets } = useReadContract({
    address: CONTRACTS.parentVault,
    abi: PARENT_VAULT_ABI,
    functionName: 'totalAssets',
  });
  
  const { data: totalShares } = useReadContract({
    address: CONTRACTS.parentVault,
    abi: PARENT_VAULT_ABI,
    functionName: 'totalSupply',
  });
  
  const sharePrice = totalAssets && totalShares && totalShares > 0n
    ? Number(totalAssets) / Number(totalShares)
    : 1;
  
  return <div>Share Price: {sharePrice.toFixed(6)} FXRP per share</div>;
}
```

## Testing the Integration

### 1. Start Frontend Dev Server

```bash
cd frontend
npm install
npm run dev
```

### 2. Connect MetaMask to Coston2

- Network Name: Coston2
- RPC URL: https://coston2-api.flare.network/ext/C/rpc
- Chain ID: 114
- Currency Symbol: C2FLR
- Explorer: https://coston2-explorer.flare.network

### 3. Get Test Tokens

Get testnet tokens from: https://faucet.flare.network/coston2
- 100 C2FLR (for gas)
- 10 FXRP (for testing deposits)

### 4. Test Basic Flows

1. **Check Balances**
   - Read your FXRP balance
   - Read vault total assets
   - Read your share balance

2. **Approve & Deposit**
   - Approve vault to spend FXRP
   - Deposit FXRP into vault
   - Receive fyFXRP shares

3. **Withdraw**
   - Redeem shares
   - Receive FXRP back

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_CHAIN_ID` | Network chain ID | `114` |
| `VITE_PARENT_VAULT_ADDRESS` | Vault proxy address | `0xdD22...78d4` |
| `VITE_FASSET_ADAPTER_ADDRESS` | FAsset adapter | `0x38e3...8369` |
| `VITE_FXRP_ADDRESS` | FXRP token | `0x0b6A...3dc7` |
| `VITE_ASSET_MANAGER_FXRP_ADDRESS` | Flare AssetManager | `0xc1Ca...bDFA` |
| `VITE_MINTING_TAG_MANAGER_ADDRESS` | Minting tag manager | `0x0945...7B96` |
| `VITE_EXPLORER_URL` | Block explorer | `https://coston2-explorer.flare.network` |

## Important Notes

### FXRP Decimals
FXRP uses **6 decimals** (not 18!):
```typescript
// Correct
parseUnits('10', 6)  // 10 FXRP = 10000000

// Wrong
parseUnits('10', 18) // Would be way too much!
```

### Share Decimals
fyFXRP shares use **18 decimals** (ERC-4626 standard with offset)

### Network Checking
Always check the user is on Coston2 (chain ID 114) before allowing transactions

### Gas Estimates
Typical gas costs on Coston2:
- Approve: ~50,000 gas
- Deposit: ~150,000 gas
- Withdraw: ~120,000 gas
- Register Tag: ~100,000 gas

## Troubleshooting

### "Wrong Network" Error
- User needs to switch to Coston2 in MetaMask
- Use wagmi's `useSwitchChain` hook to prompt network switch

### "Insufficient Balance" Error
- Check FXRP balance with `balanceOf`
- User needs tokens from faucet

### "Insufficient Allowance" Error
- Check allowance with `allowance(owner, spender)`
- User needs to approve vault first

### Contract Not Found
- Verify `.env` file exists in `frontend/` directory
- Check addresses match deployment artifacts
- Restart dev server after env changes

## Next Steps

1. ✅ Contract addresses configured
2. ⏳ Build deposit UI component
3. ⏳ Build withdrawal UI component
4. ⏳ Add transaction notifications
5. ⏳ Add loading states
6. ⏳ Add error handling
7. ⏳ Test end-to-end flow

## Resources

- [Wagmi Documentation](https://wagmi.sh/)
- [Viem Documentation](https://viem.sh/)
- [ERC-4626 Standard](https://eips.ethereum.org/EIPS/eip-4626)
- [Coston2 Explorer](https://coston2-explorer.flare.network/)
- [Coston2 Faucet](https://faucet.flare.network/coston2)

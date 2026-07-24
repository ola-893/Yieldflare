import { http, createConfig } from 'wagmi';
import { type Chain } from 'viem';
import { injected } from 'wagmi/connectors';

/**
 * Flare Mainnet chain definition.
 * Chain ID: 14 | Currency: FLR
 */
export const flare: Chain = {
  id: 14,
  name: 'Flare',
  nativeCurrency: { name: 'Flare', symbol: 'FLR', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://flare-api.flare.network/ext/C/rpc'] },
  },
  blockExplorers: {
    default: { name: 'FlareScan', url: 'https://flarescan.com' },
  },
};

/**
 * Wagmi configuration for Flare mainnet.
 * Uses injected connector (MetaMask, Coinbase Wallet, etc.)
 */
export const wagmiConfig = createConfig({
  chains: [flare],
  connectors: [injected()],
  transports: {
    [flare.id]: http(),
  },
});

/* ─── Contract addresses (Flare Mainnet) ────────────────────────────────── */
export const CONTRACTS = {
  PARENT_VAULT: '0x0000000000000000000000000000000000000000', // To be set after deployment
  FASSET_ADAPTER: '0x0000000000000000000000000000000000000000',
  KINETIC_ADAPTER: '0x0000000000000000000000000000000000000000',
  ENOSYS_ADAPTER: '0x0000000000000000000000000000000000000000',
  FXRP: '0x0000000000000000000000000000000000000000',
} as const;

/* ─── Kinetic Market Addresses ──────────────────────────────────────────── */
export const KINETIC = {
  UNITROLLER: '0x15F69897E6aEBE0463401345543C26d1Fd994abB',
  K_USDC_E: '0xDEeBaBe05BDA7e8C1740873abF715f16164C29B8',
} as const;

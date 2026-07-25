import {getDefaultConfig} from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  rabbyWallet,
  bifrostWallet,
  ledgerWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import {defineChain} from 'viem';

export const coston2 = defineChain({
  id: 114,
  name: 'Flare Coston2',
  nativeCurrency: {
    decimals: 18,
    name: 'Coston2 Flare',
    symbol: 'C2FLR',
  },
  rpcUrls: {
    default: {
      http: ['https://coston2-api.flare.network/ext/C/rpc'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Coston2 Explorer',
      url: 'https://coston2-explorer.flare.network',
    },
  },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: 'Flux Protocol',
  projectId: '3b9e0564d231d3c3a6d7d4dbda985267',
  chains: [coston2],
  // Disable EIP-6963 auto-discovery to prevent Phantom, HashPack, etc.
  // from appearing in the 'Installed' section of the wallet modal.
  multiInjectedProviderDiscovery: false,
  wallets: [
    {
      groupName: 'Recommended for Flare',
      wallets: [
        metaMaskWallet,
        rabbyWallet,
        bifrostWallet,
        ledgerWallet,
        walletConnectWallet,
      ],
    },
  ],
});

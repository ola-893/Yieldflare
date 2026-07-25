import React from 'react';
import {RainbowKitProvider, darkTheme} from '@rainbow-me/rainbowkit';
import {WagmiProvider} from 'wagmi';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {config} from '../config/wagmi';

const queryClient = new QueryClient();

export const Web3Provider: React.FC<{children: React.ReactNode}> = ({children}) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#1E1E1E',
            accentColorForeground: '#E1BAC2',
            borderRadius: 'large',
            fontStack: 'system',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

'use client';

import React, { ReactNode, useState, useEffect } from 'react';
import { http, WagmiProvider } from 'wagmi';
import {
  RainbowKitProvider,
  darkTheme,
  getDefaultConfig,
} from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@rainbow-me/rainbowkit/styles.css';

export const chordChain = defineChain({
  id: 7613,
  name: 'Chord',
  nativeCurrency: {
    decimals: 18,
    name: 'CHOR',
    symbol: 'CHOR',
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.chordchain.space'],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.chordchain.space'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ChordScan',
      url: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://scan.chordchain.space',
    },
  },
  testnet: false,
});


export const wagmiConfig = getDefaultConfig({
  appName: 'ChordScan',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '04344c530e42b6396e704f34853a5b09',
  chains: [chordChain],
  transports: {
    [chordChain.id]: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.chordchain.space'),
  },
  ssr: true,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export function WagmiAppProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          modalSize="compact"
          theme={darkTheme({
            accentColor: '#0ea5e9', // sky-500 matching ChordScan branding
            accentColorForeground: 'white',
            borderRadius: 'medium',
            fontStack: 'system',
            overlayBlur: 'small',
          })}
        >
          {mounted ? children : null}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default WagmiAppProvider;

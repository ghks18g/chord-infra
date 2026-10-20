import type { Metadata } from 'next';
import './globals.css';
import { WagmiAppProvider } from '../providers/wagmi-provider';
import { Header } from '../components/header';
import { AddressTagsProvider } from '../lib/address-tags';

export const metadata: Metadata = {
  title: 'ChordScan - Chord L1 Scan',
  description:
    'High-Performance EVM App-Chain Block Scan with Sub-Second CometBFT Finality.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="dark" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col font-sans">
        <WagmiAppProvider>
          <AddressTagsProvider>
            <Header />

            <main className="flex-1 w-full">{children}</main>
          </AddressTagsProvider>
        </WagmiAppProvider>

        <footer className="border-t border-slate-200/80 bg-white py-10 dark:border-slate-800/80 dark:bg-[#070B12] text-xs text-slate-500">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="Chord" className="h-5 w-5" />
              <span className="font-bold text-slate-800 dark:text-slate-200">ChordScan</span>
              <span className="text-slate-400">· Chord L1 Scan</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="/" className="hover:text-sky-500 dark:hover:text-sky-400 transition font-medium">
                Dashboard
              </a>
              <a href="/blocks" className="hover:text-sky-500 dark:hover:text-sky-400 transition font-medium">
                Blocks
              </a>
              <a href="/txs" className="hover:text-sky-500 dark:hover:text-sky-400 transition font-medium">
                Transactions
              </a>
              <a href="/validators" className="hover:text-sky-500 dark:hover:text-sky-400 transition font-medium">
                Validators
              </a>
              <a href="/contracts" className="hover:text-sky-500 dark:hover:text-sky-400 transition font-medium">
                Contracts
              </a>
            </div>
            <p className="text-slate-400 font-mono text-[11px]">
              © 2026 Chord Ecosystem. Sub-second BFT Finality EVM App-Chain.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

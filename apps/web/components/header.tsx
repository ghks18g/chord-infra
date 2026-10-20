'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './theme-toggle';
import { WalletConnect } from './wallet-connect';
import {
  FileCode2,
  Menu,
  X,
  ArrowLeftRight,
  Box,
  ChevronDown,
  Server,
  CheckCircle2,
  Coins,
  BarChart2,
} from 'lucide-react';

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [contractsOpen, setContractsOpen] = useState(false);

  const exploreRef = useRef<HTMLDivElement>(null);
  const contractsRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exploreRef.current && !exploreRef.current.contains(event.target as Node)) {
        setExploreOpen(false);
      }
      if (contractsRef.current && !contractsRef.current.contains(event.target as Node)) {
        setContractsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-[#070B12]/95 transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand Logo & Explorer Nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/logo.svg"
              alt="Chord Logo"
              className="h-8 w-8 transition-transform group-hover:scale-105"
            />
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                ChordScan
              </span>
              <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950/80 dark:text-sky-300 font-mono">
                L1
              </span>
            </div>
          </Link>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center gap-2 text-sm font-semibold">
            <Link
              href="/"
              className={`rounded-lg px-3 py-1.5 transition ${
                isActive('/') && pathname === '/'
                  ? 'bg-slate-100 text-sky-600 dark:bg-slate-800/80 dark:text-sky-400 font-bold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              Home
            </Link>

            {/* Explore Dropdown */}
            <div className="relative" ref={exploreRef}>
              <button
                onClick={() => {
                  setExploreOpen(!exploreOpen);
                  setContractsOpen(false);
                }}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 transition ${
                  isActive('/blocks') || isActive('/txs') || isActive('/tokens') || isActive('/validators')
                    ? 'bg-slate-100 text-sky-600 dark:bg-slate-800/80 dark:text-sky-400 font-bold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <span>Explore</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {exploreOpen && (
                <div className="absolute left-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-[#0D1424] z-50 space-y-1">
                  <Link
                    href="/blocks"
                    onClick={() => setExploreOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
                  >
                    <Box className="h-4 w-4 text-sky-500 shrink-0" />
                    <div>
                      <div className="font-bold">Blocks</div>
                      <div className="text-[10px] text-slate-400 font-normal">On-demand BFT blocks</div>
                    </div>
                  </Link>

                  <Link
                    href="/txs"
                    onClick={() => setExploreOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
                  >
                    <ArrowLeftRight className="h-4 w-4 text-sky-500 shrink-0" />
                    <div>
                      <div className="font-bold">Transactions</div>
                      <div className="text-[10px] text-slate-400 font-normal">EVM transaction stream</div>
                    </div>
                  </Link>

                  <Link
                    href="/tokens"
                    onClick={() => setExploreOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
                  >
                    <Coins className="h-4 w-4 text-sky-500 shrink-0" />
                    <div>
                      <div className="font-bold">Token Directory</div>
                      <div className="text-[10px] text-slate-400 font-normal">All ERC-20 & ERC-1155 Assets</div>
                    </div>
                  </Link>

                  <Link
                    href="/validators"
                    onClick={() => setExploreOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
                  >
                    <Server className="h-4 w-4 text-sky-500 shrink-0" />
                    <div>
                      <div className="font-bold">Validators</div>
                      <div className="text-[10px] text-slate-400 font-normal">4-Node BFT quorum</div>
                    </div>
                  </Link>

                  <Link
                    href="/statistics"
                    onClick={() => setExploreOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
                  >
                    <BarChart2 className="h-4 w-4 text-indigo-500 shrink-0" />
                    <div>
                      <div className="font-bold">Network Statistics</div>
                      <div className="text-[10px] text-slate-400 font-normal">Throughput, Gas & SMT Metrics</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* Contracts Dropdown */}
            <div className="relative" ref={contractsRef}>
              <button
                onClick={() => {
                  setContractsOpen(!contractsOpen);
                  setExploreOpen(false);
                }}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 transition ${
                  isActive('/verify') || isActive('/contracts')
                    ? 'bg-slate-100 text-sky-600 dark:bg-slate-800/80 dark:text-sky-400 font-bold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <span>Contracts</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {contractsOpen && (
                <div className="absolute left-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-[#0D1424] z-50 space-y-1">
                  <Link
                    href="/verify"
                    onClick={() => setContractsOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
                  >
                    <FileCode2 className="h-4 w-4 text-sky-500 shrink-0" />
                    <div>
                      <div className="font-bold">Verify Contract</div>
                      <div className="text-[10px] text-slate-400 font-normal">Bytecode verification</div>
                    </div>
                  </Link>

                  <Link
                    href="/contracts"
                    onClick={() => setContractsOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <div>
                      <div className="font-bold">Verified Contracts</div>
                      <div className="text-[10px] text-slate-400 font-normal">Verified smart contracts</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* Statistics Link */}
            <Link
              href="/statistics"
              className={`rounded-lg px-3 py-1.5 transition ${
                isActive('/statistics')
                  ? 'bg-slate-100 text-sky-600 dark:bg-slate-800/80 dark:text-sky-400 font-bold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              Statistics
            </Link>
          </nav>
        </div>

        {/* Right: Gas, Network, Wallet & Theme */}
        <div className="flex items-center gap-3">
          {/* Gas Price Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <span className="text-slate-400">Gas:</span>
            <span className="text-sky-500">1 Gnote</span>
          </div>

          {/* EVM Chain ID Indicator */}
          <div className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-600 dark:text-sky-400 font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Chain ID: 7613 (0x1dbd)</span>
          </div>

          {/* Connect Wallet Button */}
          <WalletConnect />

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-b border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-800 dark:bg-[#070B12] space-y-2">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Home
          </Link>
          <div className="pl-3 space-y-1 border-l-2 border-slate-200 dark:border-slate-800 ml-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-1">
              Explore
            </div>
            <Link
              href="/blocks"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Blocks
            </Link>
            <Link
              href="/txs"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Transactions
            </Link>
            <Link
              href="/tokens"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Token Directory
            </Link>
            <Link
              href="/validators"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Validators
            </Link>
            <Link
              href="/statistics"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Network Statistics
            </Link>
          </div>
          <div className="pl-3 space-y-1 border-l-2 border-slate-200 dark:border-slate-800 ml-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-1">
              Contracts
            </div>
            <Link
              href="/verify"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Verify Contract
            </Link>
            <Link
              href="/contracts"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Verified Contracts
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

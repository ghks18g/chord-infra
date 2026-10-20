'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Box,
  ArrowLeftRight,
  Activity,
  Clock,
  CheckCircle2,
  Server,
} from 'lucide-react';
import { AddressBadge } from '../components/AddressBadge';
import { TokenValueBadge } from '../components/TokenValueBadge';
import { GlobalSearch } from '../components/GlobalSearch';
import { useChordWebSocket } from '../hooks/useChordWebSocket';

interface NetworkStats {
  latestBlockHeight: number;
  latestStateRoot: string;
  totalTransactions?: number;
  activeValidators: number;
  network: string;
  evmChainId: number;
  nodeVersion: string;
  consensus: string;
  gasPrice: string;
}

interface BlockItem {
  height: number;
  hash: string;
  proposer: string;
  txCount: number;
  timestamp: string;
  finalized: boolean;
}

interface TxItem {
  hash: string;
  blockHeight: number;
  from: string;
  to: string | null;
  value: string;
  data?: string;
  status: string;
  createdAt: string;
}

export default function HomePage() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [txs, setTxs] = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedBlocks, setHighlightedBlocks] = useState<Set<number>>(new Set());
  const [highlightedTxs, setHighlightedTxs] = useState<Set<string>>(new Set());

  // Real-time WebSocket connection
  const { isConnected } = useChordWebSocket((event) => {
    if (event.type === 'new_transaction' && event.data) {
      const hashKey = event.data.hash.toLowerCase();
      setTxs((prev) => {
        const exists = prev.some((t) => t.hash.toLowerCase() === hashKey);
        if (exists) return prev;
        setHighlightedTxs((h) => new Set(h).add(hashKey));
        setTimeout(() => {
          setHighlightedTxs((h) => {
            const next = new Set(h);
            next.delete(hashKey);
            return next;
          });
        }, 3000);
        return [event.data, ...prev].slice(0, 6);
      });
      setStats((prev) =>
        prev ? { ...prev, totalTransactions: (prev.totalTransactions || 0) + 1 } : prev,
      );
    } else if (event.type === 'new_block' && event.data) {
      const blockHeight = event.data.height;
      setBlocks((prev) => {
        const exists = prev.some((b) => b.height === blockHeight);
        if (exists) return prev;
        setHighlightedBlocks((h) => new Set(h).add(blockHeight));
        setTimeout(() => {
          setHighlightedBlocks((h) => {
            const next = new Set(h);
            next.delete(blockHeight);
            return next;
          });
        }, 3000);
        return [event.data, ...prev].slice(0, 6);
      });
      setStats((prev) =>
        prev ? { ...prev, latestBlockHeight: event.data.height, latestStateRoot: event.data.stateRoot || prev.latestStateRoot } : prev,
      );
    } else if (event.type === 'network_stats' && event.data) {
      setStats((prev) => (prev ? { ...prev, ...event.data } : prev));
    }
  });

  const fetchLiveNetworkData = async () => {
    try {
      const [statsRes, blocksRes, txsRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/blocks?limit=6'),
        fetch('/api/txs?limit=6'),
      ]);

      if (statsRes.ok) {
        const s = await statsRes.json();
        setStats(s);
      }
      if (blocksRes.ok) {
        const b = await blocksRes.json();
        setBlocks(Array.isArray(b) ? b : b?.items ?? []);
      }
      if (txsRes.ok) {
        const t = await txsRes.json();
        setTxs(Array.isArray(t) ? t : t?.items ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch network data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveNetworkData();
    // When WebSocket is active, use a relaxed backup polling interval
    const intervalTime = isConnected ? 15000 : 4000;
    const interval = setInterval(fetchLiveNetworkData, intervalTime);
    return () => clearInterval(interval);
  }, [isConnected]);

  const formatAge = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diff < 60) return `${Math.max(1, diff)}s ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      return `${Math.floor(diff / 3600)}h ago`;
    } catch {
      return 'Just now';
    }
  };

  const formatChor = (weiStr: string | null | undefined): string => {
    if (!weiStr) return '0 CHOR';
    try {
      const b = BigInt(weiStr);
      if (b === 0n) return '0 CHOR';
      const chor = b / 10n**18n;
      const rem = b % 10n**18n;
      if (rem === 0n) {
        return `${chor.toLocaleString()} CHOR`;
      }
      const dec = Number(b) / 1e18;
      return `${dec.toLocaleString(undefined, { maximumFractionDigits: 6 })} CHOR`;
    } catch {
      return `${weiStr} note`;
    }
  };



  return (
    <div className="space-y-10 pb-20">
      {/* ============================================================== */}
      {/* 1. HERO & SEARCH SECTION */}
      {/* ============================================================== */}
      <section className="relative z-30 border-b border-slate-200/80 bg-gradient-to-b from-sky-500/[0.04] via-transparent to-transparent py-12 sm:py-16 dark:border-slate-800/80 dark:from-sky-950/15 dark:via-[#070B12] dark:to-[#070B12]">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="mx-auto max-w-3xl space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Explore Chord Blockchain
            </h1>
            <div className="text-xs font-mono text-slate-400">
              EVM Chain ID: <span className="font-semibold text-sky-500 dark:text-sky-400">7613</span>{' '}
              <span className="text-slate-500">(0x1dbd)</span>
            </div>
          </div>

          {/* Clean Unified Search Box with Auto-complete */}
          <GlobalSearch className="mt-6 max-w-2xl mx-auto" />
        </div>
      </section>

      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        {/* ============================================================== */}
        {/* 2. 3-METRIC OVERVIEW CARDS */}
        {/* ============================================================== */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Card 1: Latest Block Height */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-indigo-300 dark:border-slate-800 dark:bg-[#0D1424] dark:hover:border-indigo-500/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Latest Block
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                <Box className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-slate-900 dark:text-white">
                #{stats?.latestBlockHeight ?? 0}
              </span>
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {stats?.latestBlockHeight === 0 ? 'Genesis' : 'Committed'}
              </span>
            </div>
          </div>

          {/* Card 2: Total Transactions */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-sky-300 dark:border-slate-800 dark:bg-[#0D1424] dark:hover:border-sky-500/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Total Transactions
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                <ArrowLeftRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-slate-900 dark:text-white">
                {(stats?.totalTransactions ?? txs.length).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Card 3: Active Validators */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-sky-300 dark:border-slate-800 dark:bg-[#0D1424] dark:hover:border-sky-500/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Active Validators
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                <Server className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-slate-900 dark:text-white">
                {stats?.activeValidators || 4}/4
              </span>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                Active
              </span>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* 3. DUAL FEED: Latest Blocks & Latest Transactions */}
        {/* ============================================================== */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left Column: Latest Blocks */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0D1424] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                  <Box className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Latest Blocks
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
                <Link
                  href="/blocks"
                  className="text-xs font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:underline transition"
                >
                  View All →
                </Link>
              </div>
            </div>

            {/* Block Feed Rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 flex-1">
              {blocks.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-400 font-mono">
                  {loading ? 'Loading blocks...' : 'No blocks recorded'}
                </div>
              ) : (
                blocks.map((block) => {
                  const isNew = highlightedBlocks.has(block.height);
                  return (
                    <div
                      key={block.height}
                      className={`flex items-center justify-between px-5 py-3.5 transition-all duration-700 gap-3 min-h-[74px] ${
                        isNew
                          ? 'bg-sky-500/10 dark:bg-sky-500/15 border-l-4 border-l-sky-500 animate-in fade-in-50 slide-in-from-top-1'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      {/* Left: Box Icon & Height */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sky-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-sky-400 shrink-0 shadow-xs">
                          <Box className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/block/${block.height}`}
                            className="font-mono text-sm font-bold text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:underline block truncate"
                          >
                            #{block.height}
                          </Link>
                          <p className="text-[11px] text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                            <Clock className="h-3 w-3 shrink-0" /> {formatAge(block.timestamp)}
                          </p>
                        </div>
                      </div>

                      {/* Middle: Validator & Tx count */}
                      <div className="hidden sm:block text-left font-mono min-w-0 flex-1 space-y-0.5">
                        <div className="text-xs text-slate-600 dark:text-slate-300 truncate flex items-center gap-1.5">
                          <span className="text-slate-400 shrink-0">By</span>
                          <AddressBadge address={block.proposer} />
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          <span className="font-semibold text-sky-600 dark:text-sky-400">
                            {block.txCount} txns
                          </span>{' '}
                          • CometBFT 0.4s
                        </div>
                      </div>

                      {/* Right: Status badge */}
                      <div className="text-right shrink-0 font-mono">
                        <span className="inline-block rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-xs">
                          Block #{block.height}
                        </span>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center justify-end gap-1">
                          <CheckCircle2 className="h-3 w-3 shrink-0" /> Finalized
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Latest Transactions */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0D1424] overflow-hidden flex flex-col">
            {/* Header (Unified ArrowLeftRight Icon) */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                  <ArrowLeftRight className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Latest Transactions
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold font-mono ${
                  isConnected ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-500/10 text-slate-500'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {isConnected ? 'LIVE WS' : 'SYNCING'}
                </span>
                <Link
                  href="/txs"
                  className="text-xs font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:underline transition"
                >
                  View All →
                </Link>
              </div>
            </div>

            {/* Transactions Feed Rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 flex-1">
              {txs.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-400 font-mono">
                  {loading ? 'Loading transactions...' : 'No transactions recorded'}
                </div>
              ) : (
                txs.map((tx) => {
                  const isNew = highlightedTxs.has(tx.hash.toLowerCase());
                  return (
                    <div
                      key={tx.hash}
                      className={`flex items-center justify-between px-5 py-3.5 transition-all duration-700 gap-3 min-h-[74px] ${
                        isNew
                          ? 'bg-sky-500/10 dark:bg-sky-500/15 border-l-4 border-l-sky-500 animate-in fade-in-50 slide-in-from-top-1'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      {/* Left: Arrow Icon & Hash */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sky-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-sky-400 shrink-0 shadow-xs">
                          <ArrowLeftRight className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/tx/${tx.hash}`}
                            className="font-mono text-sm font-bold text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:underline truncate w-28 sm:w-32 block"
                            title={tx.hash}
                          >
                            {tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}
                          </Link>
                          <p className="text-[11px] text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                            <Clock className="h-3 w-3 shrink-0" /> {formatAge(tx.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* Middle: From -> To */}
                      <div className="hidden sm:block text-left font-mono min-w-0 flex-1 space-y-0.5">
                        <div className="text-xs text-slate-600 dark:text-slate-300 truncate flex items-center gap-1.5">
                          <span className="text-slate-400 w-8 shrink-0">From</span>
                          <AddressBadge address={tx.from} />
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                          <span className="text-slate-400 w-8 shrink-0">To</span>
                          {tx.to ? (
                            <AddressBadge address={tx.to} />
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 text-[10px] font-bold">
                              [Contract Deploy]
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Value badge & Success */}
                      <div className="text-right shrink-0 font-mono">
                        <span className="inline-block rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 px-2.5 py-0.5 text-xs font-bold shadow-xs">
                          <TokenValueBadge value={tx.value} />
                        </span>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center justify-end gap-1">
                          <CheckCircle2 className="h-3 w-3 shrink-0" /> Success
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

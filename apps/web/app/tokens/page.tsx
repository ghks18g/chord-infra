'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Coins,
  Search,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { AddressBadge } from '../../components/AddressBadge';

interface TokenItem {
  name: string;
  symbol: string;
  standard: 'Native' | 'ERC-1155' | 'ERC-20' | 'ERC-721';
  address: string;
  decimals: number;
  description: string;
  isVerified: boolean;
  isProxy: boolean;
  implementationAddress?: string;
  transfersCount: number;
}

export default function TokensPage() {
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStandard, setSelectedStandard] = useState<'ALL' | 'ERC-1155' | 'ERC-20' | 'Native'>('ALL');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTokens() {
      setLoading(true);
      try {
        const res = await fetch('/api/tokens');
        if (res.ok) {
          const data = await res.json();
          setTokens(data);
        }
      } catch (err) {
        console.error('Failed to fetch tokens:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTokens();
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const filteredTokens = tokens.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.address.toLowerCase().includes(search.toLowerCase());

    const matchesStandard =
      selectedStandard === 'ALL' || t.standard === selectedStandard;

    return matchesSearch && matchesStandard;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Tokens Directory
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                Native Gas, Multi-Token (ERC-1155) & Fungible Assets on Chord
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            Total <span className="font-bold text-sky-500">{tokens.length}</span> Tracked Assets
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Standard Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 w-fit">
          {(['ALL', 'ERC-1155', 'ERC-20', 'Native'] as const).map((std) => (
            <button
              key={std}
              onClick={() => setSelectedStandard(std)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                selectedStandard === std
                  ? 'bg-white text-sky-600 shadow-sm dark:bg-[#0D1424] dark:text-sky-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {std}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Token Name, Symbol, or Address..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-xs font-mono outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-[#0D1424] dark:text-white"
          />
        </div>
      </div>

      {/* Tokens Table Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0D1424] overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
                    <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800/60 animate-pulse rounded" />
                  </div>
                </div>
                <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-md" />
              </div>
            ))}
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Coins className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No matching tokens found
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Try adjusting your search query or standard filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto font-mono text-xs">
            <table className="w-full text-left">
              <thead className="border-b border-slate-200/80 bg-slate-50/50 text-slate-600 dark:border-slate-800/80 dark:bg-slate-900/40 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4">Token Name & Symbol</th>
                  <th className="py-3 px-4">Standard</th>
                  <th className="py-3 px-4">Contract Address</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Transfers</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredTokens.map((token, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition group"
                  >
                    {/* Token Name & Symbol */}
                    <td className="py-3.5 px-4 font-sans">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/10 to-indigo-500/10 text-sky-500 font-bold border border-sky-500/20 overflow-hidden shrink-0">
                          {token.symbol === 'CHOR' || token.address === '0x0000000000000000000000000000000000000000' ? (
                            <img src="/logo.svg" alt="Chord" className="h-5 w-5 object-contain" />
                          ) : (
                            token.symbol.slice(0, 3)
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{token.name}</span>
                            {token.isVerified && (
                              <span title="Verified Contract">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] font-semibold text-slate-400">
                            {token.symbol}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Standard Badge */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          token.standard === 'ERC-1155'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400'
                            : token.standard === 'ERC-20'
                            ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                        }`}
                      >
                        {token.standard}
                      </span>
                    </td>

                    {/* Contract Address */}
                    <td className="py-3.5 px-4">
                      {token.address === '0x0000000000000000000000000000000000000000' ? (
                        <span className="text-slate-400 italic">Native Gas Asset</span>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-sky-600 dark:text-sky-400">
                            <Link
                              href={`/address/${token.address}`}
                              className="hover:underline"
                            >
                              {token.address.slice(0, 10)}...{token.address.slice(-8)}
                            </Link>
                            <button
                              onClick={() => copyToClipboard(token.address, `addr-${idx}`)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                              title="Copy Address"
                            >
                              {copied === `addr-${idx}` ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                          {token.isProxy && token.implementationAddress && (
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span>UUPS ➔</span>
                              <Link
                                href={`/address/${token.implementationAddress}`}
                                className="text-indigo-500 hover:underline"
                              >
                                {token.implementationAddress.slice(0, 8)}...
                              </Link>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4 font-sans text-slate-600 dark:text-slate-300 text-xs">
                      {token.description}
                    </td>

                    {/* Transfers Count */}
                    <td className="py-3.5 px-4 text-center font-bold text-slate-700 dark:text-slate-300">
                      {token.transfersCount.toLocaleString()}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      {token.address !== '0x0000000000000000000000000000000000000000' ? (
                        <Link
                          href={`/address/${token.address}?tab=contract`}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/40 transition cursor-pointer"
                        >
                          <span>Interact</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <Link
                          href="/statistics"
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          <span>Stats</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

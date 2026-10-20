'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Box,
  Clock,
  CheckCircle2,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react';
import { AddressBadge } from '../../../components/AddressBadge';
import { TokenValueBadge } from '../../../components/TokenValueBadge';

interface BlockDetail {
  height: number;
  hash: string;
  prevHash: string;
  stateRoot: string;
  txRoot: string;
  proposer: string;
  txCount: number;
  timestamp: string;
  finalized: boolean;
  gasUsed?: number;
  gasLimit?: number;
  transactions?: any[];
}

export default function BlockDetailPage({
  params,
}: {
  params: Promise<{ height: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const height = resolvedParams.height;

  const [block, setBlock] = useState<BlockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBlock() {
      setLoading(true);
      try {
        const res = await fetch(`/api/blocks/${height}`);
        if (res.ok) {
          const data = await res.json();
          setBlock(data);
        } else {
          setBlock(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchBlock();
  }, [height]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatChor = (weiStr: string | null | undefined): string => {
    if (!weiStr) return '0 CHOR';
    try {
      const b = BigInt(weiStr);
      if (b === 0n) return '0 CHOR';
      const chor = b / 10n ** 18n;
      const rem = b % 10n ** 18n;
      if (rem === 0n) {
        return `${chor.toLocaleString()} CHOR`;
      }
      const dec = Number(b) / 1e18;
      return `${dec.toLocaleString(undefined, { maximumFractionDigits: 6 })} CHOR`;
    } catch {
      return `${weiStr} note`;
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-slate-400 font-mono text-sm">
        Loading Block #{height} data...
      </div>
    );
  }

  if (!block) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Block Not Found</h2>
        <p className="text-sm text-slate-500">The requested block #{height} does not exist on-chain.</p>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Previous
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60 transition cursor-pointer"
            title="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Box className="h-6 w-6 text-sky-500" />
              Block #{block.height}
              {block.height === 0 && (
                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs font-bold text-sky-400 font-mono">
                  Genesis Block
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              Chord L1 Block Details & CometBFT Consensus Finality
            </p>
          </div>
        </div>
      </div>

      {/* Block Information Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0D1424] divide-y divide-slate-100 dark:divide-slate-800/60 text-xs sm:text-sm">
        {/* Height */}
        <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
          <span className="w-48 text-slate-500 dark:text-slate-400 font-medium">Block Height</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-2">
            #{block.height}
            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Finalized (CometBFT)
            </span>
          </span>
        </div>

        {/* Timestamp */}
        <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
          <span className="w-48 text-slate-500 dark:text-slate-400 font-medium">Timestamp</span>
          <span className="font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-slate-400" />
            {new Date(block.timestamp).toLocaleString()} ({new Date(block.timestamp).toISOString()})
          </span>
        </div>

        {/* Transactions */}
        <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
          <span className="w-48 text-slate-500 dark:text-slate-400 font-medium">Transactions</span>
          <span className="font-mono text-slate-700 dark:text-slate-300">
            <span className="rounded bg-sky-50 px-2 py-0.5 font-bold text-sky-700 dark:bg-sky-950/80 dark:text-sky-300 mr-2">
              {block.txCount} transactions
            </span>
            in this block
          </span>
        </div>

        {/* Proposer */}
        <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
          <span className="w-48 text-slate-500 dark:text-slate-400 font-medium">Proposer</span>
          <div className="font-mono text-slate-800 dark:text-slate-200 font-medium flex items-center gap-2">
            <AddressBadge address={block.proposer} truncate={false} />
          </div>
        </div>

        {/* Gas Used / Gas Limit */}
        <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
          <span className="w-48 text-slate-500 dark:text-slate-400 font-medium">Gas Used</span>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 font-mono text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {(block.gasUsed || 21000).toLocaleString()} / {(block.gasLimit || 30000000).toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400">
              ({(((block.gasUsed || 21000) / (block.gasLimit || 30000000)) * 100).toFixed(2)}%)
            </span>
            <div className="w-32 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden shrink-0">
              <div
                className="bg-sky-500 h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(1, Math.min(100, (((block.gasUsed || 21000) / (block.gasLimit || 30000000)) * 100)))}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Block Hash */}
        <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
          <span className="w-48 text-slate-500 dark:text-slate-400 font-medium">Block Hash</span>
          <div className="flex items-center gap-2 font-mono text-xs break-all text-slate-800 dark:text-slate-200">
            <span>{block.hash}</span>
            <button
              onClick={() => copyToClipboard(block.hash, 'hash')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
              title="Copy Hash"
            >
              {copied === 'hash' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Parent Hash */}
        <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
          <span className="w-48 text-slate-500 dark:text-slate-400 font-medium">Parent Hash</span>
          <div className="flex items-center gap-2 font-mono text-xs break-all text-slate-800 dark:text-slate-200">
            <span>{block.prevHash}</span>
            <button
              onClick={() => copyToClipboard(block.prevHash, 'prevHash')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
              title="Copy Parent Hash"
            >
              {copied === 'prevHash' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* State Root */}
        <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
          <span className="w-48 text-slate-500 dark:text-slate-400 font-medium">State Root (SMT)</span>
          <div className="flex items-center gap-2 font-mono text-xs break-all text-slate-800 dark:text-slate-200">
            <span>{block.stateRoot}</span>
            <button
              onClick={() => copyToClipboard(block.stateRoot, 'stateRoot')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
              title="Copy State Root"
            >
              {copied === 'stateRoot' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0D1424] space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Transactions in this Block
        </h3>

        {!block.transactions || block.transactions.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-6 text-center dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No transactions included in this block.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto font-mono text-xs">
            <table className="w-full text-left">
              <thead className="border-b border-slate-200/80 bg-slate-50/50 text-slate-600 dark:border-slate-800/80 dark:bg-slate-900/40 dark:text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Transaction Hash</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">From</th>
                  <th className="py-2.5 px-3">To</th>
                  <th className="py-2.5 px-3 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {block.transactions.map((tx: any) => (
                  <tr key={tx.hash} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3">
                      <Link href={`/tx/${tx.hash}`} className="text-sky-600 dark:text-sky-400 hover:underline">
                        {tx.hash.slice(0, 16)}...
                      </Link>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold font-sans ${
                        tx.methodName && !tx.methodName.startsWith('0x')
                          ? 'bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400'
                          : 'bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400 font-mono'
                      }`}>
                        {tx.methodName || (tx.to ? 'Transfer' : 'Contract Deploy')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {tx.from ? <AddressBadge address={tx.from} /> : '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      {tx.to ? (
                        <AddressBadge address={tx.to} />
                      ) : (
                        <span className="text-emerald-500 font-semibold">[Contract Deploy]</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <TokenValueBadge value={tx.value} className="justify-end" />
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

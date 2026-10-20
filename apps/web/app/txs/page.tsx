'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  ArrowRight,
  Clock,
  RefreshCw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { AddressBadge } from '../../components/AddressBadge';
import { TokenValueBadge } from '../../components/TokenValueBadge';
import { useChordWebSocket } from '../../hooks/useChordWebSocket';

interface TxItem {
  hash: string;
  blockHeight: number;
  from: string;
  to: string | null;
  value: string;
  data?: string;
  status: string;
  createdAt: string;
  methodName?: string;
  contract?: {
    name: string | null;
    isVerified: boolean;
  } | null;
}

function getTxMethod(tx: TxItem): { label: string; bg: string; text: string } {
  if (!tx.to) {
    return { label: 'Contract Deploy', bg: 'bg-indigo-500/10 border-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400' };
  }
  const toLower = tx.to.toLowerCase();
  const dataLower = (tx.data || '').toLowerCase();

  // Native token transfer (empty or 0x calldata)
  if (!dataLower || dataLower === '0x' || dataLower === '0x0') {
    return {
      label: 'Transfer',
      bg: 'bg-slate-500/10 border-slate-500/20',
      text: 'text-slate-600 dark:text-slate-400',
    };
  }

  // 1. If contract is verified and method name was resolved (e.g. 'claim', 'execute', etc.)
  if (tx.methodName && !tx.methodName.startsWith('0x')) {
    return {
      label: tx.methodName,
      bg: 'bg-sky-500/10 border-sky-500/20',
      text: 'text-sky-600 dark:text-sky-400 font-semibold',
    };
  }

  // 2. EIP Global Standard Token Function Selectors (ERC-20 / ERC-721 / ERC-1155)
  if (dataLower.startsWith('0xa9059cbb')) {
    return { label: 'Transfer (ERC-20)', bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' };
  }
  if (dataLower.startsWith('0x095ea7b3')) {
    return { label: 'Approve (ERC-20)', bg: 'bg-sky-500/10 border-sky-500/20', text: 'text-sky-600 dark:text-sky-400' };
  }
  if (dataLower.startsWith('0x23b872dd')) {
    return { label: 'TransferFrom (ERC-20/721)', bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' };
  }
  if (dataLower.startsWith('0x42842e0e') || dataLower.startsWith('0xb88d4fde')) {
    return { label: 'SafeTransferFrom (ERC-721)', bg: 'bg-purple-500/10 border-purple-500/20', text: 'text-purple-600 dark:text-purple-400' };
  }
  if (dataLower.startsWith('0xf242432a')) {
    return { label: 'SafeTransferFrom (ERC-1155)', bg: 'bg-indigo-500/10 border-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400' };
  }
  if (dataLower.startsWith('0x2eb2c2d6')) {
    return { label: 'SafeBatchTransferFrom (ERC-1155)', bg: 'bg-indigo-500/10 border-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400' };
  }

  // 3. Without verified ABI, unverified custom contract calls must strictly display the raw 4-byte MethodID hex
  const methodId = tx.methodName || dataLower.slice(0, 10);
  return {
    label: methodId,
    bg: 'bg-slate-500/10 border-slate-500/20',
    text: 'text-slate-600 dark:text-slate-400 font-mono',
  };
}

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { address: connectedAddress } = useAccount();
  const myAddr = connectedAddress?.toLowerCase();

  const urlPage = parseInt(searchParams.get('page') || '1', 10);
  const [currentPage, setCurrentPage] = useState(isNaN(urlPage) || urlPage < 1 ? 1 : urlPage);
  const [pageSize] = useState(25);
  const [txs, setTxs] = useState<TxItem[]>([]);
  const [totalTxs, setTotalTxs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Real-time WebSocket listener
  const { isConnected } = useChordWebSocket((event) => {
    if (event.type === 'new_transaction' && event.data) {
      setTotalTxs((prev) => prev + 1);
      if (currentPage === 1) {
        setTxs((prev) => {
          const exists = prev.some((t) => t.hash.toLowerCase() === event.data.hash.toLowerCase());
          if (exists) return prev;
          return [event.data, ...prev].slice(0, pageSize);
        });
      }
    }
  });

  const fetchTxs = async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/txs?page=${page}&limit=${pageSize}`);
      const data = await res.json();
      if (data && typeof data === 'object' && Array.isArray(data.items)) {
        setTxs(data.items);
        setTotalTxs(data.total || data.items.length);
        setTotalPages(data.totalPages || 1);
      } else if (Array.isArray(data)) {
        setTxs(data);
        setTotalTxs(data.length);
        setTotalPages(Math.ceil(data.length / pageSize) || 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTxs(currentPage);
  }, [currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    router.push(`/txs?page=${newPage}`, { scroll: false });
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

  const startIdx = totalTxs === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalTxs);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <ArrowLeftRight className="h-6 w-6 text-sky-500" />
            Transactions
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time EVM transaction stream on Chord &bull; Total{' '}
            <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
              {totalTxs.toLocaleString()}
            </span>{' '}
            transactions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold font-mono ${
            isConnected
              ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
              : 'border border-slate-500/20 bg-slate-500/10 text-slate-500'
          }`}>
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            {isConnected ? 'Live WebSocket' : 'Connecting...'}
          </span>
          <button
            onClick={() => fetchTxs(currentPage)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-sky-500' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Top Pagination & Range Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
        <div>
          Showing{' '}
          <span className="font-bold text-slate-900 dark:text-white">{startIdx.toLocaleString()}</span> to{' '}
          <span className="font-bold text-slate-900 dark:text-white">{endIdx.toLocaleString()}</span> of{' '}
          <span className="font-bold text-slate-900 dark:text-white">{totalTxs.toLocaleString()}</span> transactions
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage <= 1 || loading}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="px-3 py-1 text-xs font-bold rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage >= totalPages || loading}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Transactions Table Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0D1424] overflow-hidden">
        {loading && txs.length === 0 ? (
          <div className="p-8 space-y-4 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
            ))}
          </div>
        ) : txs.length === 0 ? (
          <div className="py-16 px-6 text-center text-xs text-slate-400 font-mono">
            No transactions recorded
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-slate-200/80 bg-slate-50 font-sans text-slate-600 dark:border-slate-800/80 dark:bg-slate-900/40 dark:text-slate-400">
                <tr>
                  <th className="py-3.5 px-6">Tx Hash</th>
                  <th className="py-3.5 px-6">Method</th>
                  <th className="py-3.5 px-6">Block</th>
                  <th className="py-3.5 px-6">From</th>
                  <th className="py-3.5 px-6">To</th>
                  <th className="py-3.5 px-6">Value</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {txs.map((tx) => {
                  const method = getTxMethod(tx);
                  const isOut = Boolean(myAddr && tx.from.toLowerCase() === myAddr);
                  const isIn = Boolean(myAddr && tx.to && tx.to.toLowerCase() === myAddr);

                  return (
                    <tr
                      key={tx.hash}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition"
                    >
                      <td className="py-3.5 px-6 font-semibold">
                        <Link
                          href={`/tx/${tx.hash}`}
                          className="text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:underline"
                        >
                          {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                        </Link>
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold font-sans ${method.bg} ${method.text}`}
                        >
                          {method.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        <Link
                          href={`/block/${tx.blockHeight}`}
                          className="hover:underline text-slate-700 dark:text-slate-300 font-bold"
                        >
                          #{tx.blockHeight}
                        </Link>
                      </td>
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-300">
                        <AddressBadge address={tx.from} />
                      </td>
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-300">
                        {tx.to ? (
                          <AddressBadge address={tx.to} />
                        ) : (
                          <span className="text-emerald-500 font-semibold">[Contract Deploy]</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6">
                        <TokenValueBadge
                          value={tx.value}
                          direction={isOut ? 'OUT' : isIn ? 'IN' : undefined}
                        />
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 font-sans">
                          <CheckCircle2 className="h-3 w-3" />
                          Success
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right text-slate-400">
                        {new Date(tx.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200/80 pt-4 dark:border-slate-800/80 text-xs font-mono">
          <div className="text-slate-500 dark:text-slate-400">
            Page <span className="font-bold text-slate-900 dark:text-white">{currentPage}</span> of{' '}
            <span className="font-bold text-slate-900 dark:text-white">{totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage <= 1 || loading}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 cursor-pointer"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
              <span>First</span>
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage >= totalPages || loading}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 cursor-pointer"
            >
              <span>Last</span>
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

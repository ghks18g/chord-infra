'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Box,
  Clock,
  RefreshCw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useChordWebSocket } from '../../hooks/useChordWebSocket';

interface BlockItem {
  height: number;
  hash: string;
  prevHash: string;
  stateRoot: string;
  proposer: string;
  txCount: number;
  timestamp: string;
  finalized: boolean;
}

export default function BlocksPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlPage = parseInt(searchParams.get('page') || '1', 10);
  const [currentPage, setCurrentPage] = useState(isNaN(urlPage) || urlPage < 1 ? 1 : urlPage);
  const [pageSize] = useState(25);
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Real-time WebSocket listener
  const { isConnected } = useChordWebSocket((event) => {
    if (event.type === 'new_block' && event.data) {
      setTotalBlocks((prev) => Math.max(prev + 1, event.data.height));
      if (currentPage === 1) {
        setBlocks((prev) => {
          const exists = prev.some((b) => b.height === event.data.height);
          if (exists) return prev;
          return [event.data, ...prev].slice(0, pageSize);
        });
      }
    }
  });

  const fetchBlocks = async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/blocks?page=${page}&limit=${pageSize}`);
      const data = await res.json();
      if (data && typeof data === 'object' && Array.isArray(data.items)) {
        setBlocks(data.items);
        setTotalBlocks(data.total || data.items.length);
        setTotalPages(data.totalPages || 1);
      } else if (Array.isArray(data)) {
        setBlocks(data);
        setTotalBlocks(data.length);
        setTotalPages(Math.ceil(data.length / pageSize) || 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocks(currentPage);
  }, [currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    router.push(`/blocks?page=${newPage}`, { scroll: false });
  };

  const startIdx = totalBlocks === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalBlocks);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Box className="h-6 w-6 text-sky-500" />
            Blocks
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time on-demand BFT committed blocks on Chord &bull; Total{' '}
            <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
              {totalBlocks.toLocaleString()}
            </span>{' '}
            blocks
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
            onClick={() => fetchBlocks(currentPage)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 cursor-pointer self-start sm:self-auto"
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
          <span className="font-bold text-slate-900 dark:text-white">{totalBlocks.toLocaleString()}</span> blocks
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

      {/* Blocks Table Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0D1424] overflow-hidden">
        {loading && blocks.length === 0 ? (
          <div className="p-8 space-y-4 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-slate-200/80 bg-slate-50 font-sans text-slate-600 dark:border-slate-800/80 dark:bg-slate-900/40 dark:text-slate-400">
                <tr>
                  <th className="py-3.5 px-6">Block Height</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Block Hash</th>
                  <th className="py-3.5 px-6">Proposer</th>
                  <th className="py-3.5 px-6 text-center">Txns</th>
                  <th className="py-3.5 px-6 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {blocks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No blocks recorded
                    </td>
                  </tr>
                ) : (
                  blocks.map((b) => (
                    <tr
                      key={b.height}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition"
                    >
                      <td className="py-3.5 px-6 font-semibold">
                        <Link
                          href={`/block/${b.height}`}
                          className="text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:underline font-bold"
                        >
                          #{b.height}
                        </Link>
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 font-sans">
                          <CheckCircle2 className="h-3 w-3" />
                          Finalized
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-slate-500">
                        <span title={b.hash}>
                          {b.hash.slice(0, 14)}...{b.hash.slice(-10)}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-slate-700 dark:text-slate-300 font-sans font-semibold">
                        {b.proposer}
                      </td>
                      <td className="py-3.5 px-6 text-center font-bold text-slate-900 dark:text-white">
                        <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5">
                          {b.txCount ?? 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right text-slate-400">
                        {new Date(b.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
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

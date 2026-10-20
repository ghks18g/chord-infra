'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileCode2,
  CheckCircle2,
  ShieldCheck,
  Search,
  ExternalLink,
  Code2,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
} from 'lucide-react';

interface VerifiedContractItem {
  address: string;
  name: string;
  compiler: string;
  version: string;
  optimization: boolean;
  verifiedAt: string;
  txCount: number;
  balance: string;
  isProxy?: boolean;
  proxyType?: string | null;
  implementationAddress?: string | null;
}

export default function VerifiedContractsPage() {
  const [search, setSearch] = useState('');
  const [contracts, setContracts] = useState<VerifiedContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setLoading(true);
    fetch('/api/contracts/verified?limit=100')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setContracts(data);
        } else {
          setContracts([]);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch verified contracts:', err);
        setContracts([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = contracts.filter(
    (c) =>
      c.address.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.implementationAddress && c.implementationAddress.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const pagedContracts = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Breadcrumb & Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-sky-500">Home</Link>
          <span>/</span>
          <span className="text-slate-700 dark:text-slate-300">Contracts</span>
          <span>/</span>
          <span className="text-sky-600 dark:text-sky-400 font-semibold">Verified Contracts</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              Verified Contracts
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Publicly verified smart contracts with byte-level bytecode integrity on Chord
            </p>
          </div>
          <Link
            href="/verify"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-sky-600/20 hover:bg-sky-500 transition shrink-0 cursor-pointer"
          >
            <FileCode2 className="h-4 w-4" />
            <span>Verify Contract</span>
          </Link>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by Contract Name or 0x Address..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-xs font-mono text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-[#0D1424] dark:text-white"
          />
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          <span>
            Total <span className="font-bold text-sky-500">{filtered.length}</span> verified contracts
          </span>
          {totalPages > 1 && (
            <span className="text-slate-500">
              (Page {currentPage} of {totalPages})
            </span>
          )}
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0D1424] overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800/80 dark:bg-slate-900/40 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3.5">Contract Address</th>
                  <th className="px-6 py-3.5">Contract Name</th>
                  <th className="px-6 py-3.5">Type / Compiler</th>
                  <th className="px-6 py-3.5">Optimization</th>
                  <th className="px-6 py-3.5">Verified Date</th>
                  <th className="px-6 py-3.5">Balance</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {pagedContracts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No verified smart contracts matching search criteria.
                    </td>
                  </tr>
                ) : (
                  pagedContracts.map((item) => (
                    <tr
                      key={item.address}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/address/${item.address}`}
                          className="font-bold text-sky-600 hover:text-sky-500 dark:text-sky-400 flex items-center gap-1.5"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span>
                            {item.address.slice(0, 10)}...{item.address.slice(-8)}
                          </span>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.name}
                          </span>
                          {item.isProxy && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400 font-sans font-medium">
                              <Layers className="h-3 w-3 shrink-0" />
                              <span>{item.proxyType || 'UUPS'} Proxy</span>
                              {item.implementationAddress && (
                                <Link
                                  href={`/address/${item.implementationAddress}`}
                                  className="text-slate-400 hover:text-sky-500 font-mono ml-0.5"
                                  title="View Implementation"
                                >
                                  &rarr; {item.implementationAddress.slice(0, 6)}...{item.implementationAddress.slice(-4)}
                                </Link>
                              )}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-sans font-medium">
                          {item.version}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {item.optimization ? (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500/20 font-sans">
                            Enabled (200 runs)
                          </span>
                        ) : (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-sans">
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-[11px]">
                        {item.verifiedAt}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                        {item.balance}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/address/${item.address}`}
                          className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-500 dark:text-sky-400 font-semibold hover:underline"
                        >
                          <span>Code & ABI</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
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
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200/80 pt-4 dark:border-slate-800/80 text-xs font-mono">
          <div className="text-slate-500 dark:text-slate-400">
            Showing{' '}
            <span className="font-bold text-slate-900 dark:text-white">
              {(currentPage - 1) * pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-bold text-slate-900 dark:text-white">
              {Math.min(currentPage * pageSize, filtered.length)}
            </span>{' '}
            of{' '}
            <span className="font-bold text-slate-900 dark:text-white">{filtered.length}</span> verified contracts
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 cursor-pointer"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
              <span>First</span>
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-3 py-1 font-bold rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage >= totalPages}
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

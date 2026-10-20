'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Box,
  ArrowLeftRight,
  FileCode2,
  Wallet,
  Coins,
  ChevronRight,
  AlertCircle,
  X,
} from 'lucide-react';

interface SearchResult {
  type: 'contract' | 'token' | 'address' | 'block' | 'tx';
  title: string;
  subtitle: string;
  url: string;
  badge?: string;
}

interface GlobalSearchProps {
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function GlobalSearch({
  placeholder = 'Search by Address (0x...), Contract Name, Txn Hash, Block...',
  className = '',
}: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced Search
  useEffect(() => {
    const trimmed = query.trim();
    setSearchError(null);
    setSelectedIndex(-1);

    if (!trimmed) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data: SearchResult[] = await res.json();
          setResults(data);
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) return;

    // If an item is selected with keyboard arrow keys
    if (selectedIndex >= 0 && selectedIndex < results.length) {
      setIsOpen(false);
      router.push(results[selectedIndex].url);
      return;
    }

    // 1. If autocomplete has matched results, navigate to the first match!
    if (results.length > 0) {
      setIsOpen(false);
      router.push(results[0].url);
      return;
    }

    // 2. Strict format checks:
    const isTxHash = /^0x[0-9a-fA-F]{64}$/.test(q);
    const isAddress = /^0x[0-9a-fA-F]{40}$/.test(q);
    const isBlock = /^\d+$/.test(q);

    if (isTxHash) {
      setIsOpen(false);
      router.push(`/tx/${q}`);
    } else if (isAddress) {
      setIsOpen(false);
      router.push(`/address/${q}`);
    } else if (isBlock) {
      setIsOpen(false);
      router.push(`/block/${q}`);
    } else {
      // 3. User entered an unindexed partial or invalid string
      // DO NOT navigate blindly to /address/! Keep dropdown open with helpful error
      setIsOpen(true);
      if (q.startsWith('0x') && q.length < 42) {
        setSearchError(
          `Incomplete address prefix (${q.length}/42 chars). No indexed accounts match "${q}".`
        );
      } else {
        setSearchError(
          `No matching records found for "${q}". Please enter a valid 42-character address, transaction hash, or block number.`
        );
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && results.length > 0) {
        setIsOpen(true);
      } else if (results.length > 0) {
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'block':
        return <Box className="h-4 w-4 text-indigo-500 shrink-0" />;
      case 'tx':
        return <ArrowLeftRight className="h-4 w-4 text-sky-500 shrink-0" />;
      case 'contract':
        return <FileCode2 className="h-4 w-4 text-emerald-500 shrink-0" />;
      case 'token':
        return <Coins className="h-4 w-4 text-sky-500 shrink-0" />;
      case 'address':
      default:
        return <Wallet className="h-4 w-4 text-amber-500 shrink-0" />;
    }
  };

  return (
    <div ref={containerRef} className={`relative z-40 w-full ${className}`}>
      <form onSubmit={handleSubmit} className="relative w-full">
        <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-sky-950/5 transition focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 dark:border-slate-800 dark:bg-[#0D1424] dark:shadow-[0_10px_35px_rgba(0,0,0,0.5)]">
          <div className="relative flex flex-1 items-center px-4 py-2">
            <Search className="h-4 w-4 text-sky-500 shrink-0 mr-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (query.trim().length > 0) setIsOpen(true);
              }}
              placeholder={placeholder}
              className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none font-mono dark:text-white dark:placeholder-slate-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setIsOpen(false);
                  setSearchError(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mr-2 cursor-pointer"
                title="Clear input"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {loading && (
              <span className="text-[11px] font-mono text-slate-400 animate-pulse mr-2">
                Searching...
              </span>
            )}
          </div>

          <button
            type="submit"
            className="flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-500/20 transition hover:from-sky-400 hover:to-indigo-500 shrink-0 cursor-pointer"
          >
            Search
          </button>
        </div>
      </form>

      {/* Autocomplete & Feedback Dropdown */}
      {isOpen && query.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0D1424] overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/60 animate-in fade-in slide-in-from-top-2 duration-150">
          {searchError && (
            <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {results.length > 0 ? (
            <>
              <div className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider font-bold text-slate-400 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
                <span>Instant Search Suggestions</span>
                <span>{results.length} results</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {results.map((item, idx) => {
                  const isSelected = selectedIndex === idx;
                  return (
                    <Link
                      key={idx}
                      href={item.url}
                      onClick={() => {
                        setIsOpen(false);
                        setQuery('');
                      }}
                      className={`flex items-center justify-between px-4 py-3 transition group cursor-pointer ${
                        isSelected
                          ? 'bg-sky-50 dark:bg-sky-950/40 border-l-2 border-sky-500'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/80">
                          {getIcon(item.type)}
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate group-hover:text-sky-500 transition">
                              {item.title}
                            </span>
                            {item.badge && (
                              <span className="rounded px-1.5 py-0.5 text-[10px] font-mono font-bold bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400 truncate">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-sky-500 group-hover:translate-x-0.5 transition shrink-0 ml-2" />
                    </Link>
                  );
                })}
              </div>
            </>
          ) : (
            !loading && (
              <div className="p-6 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 mb-2">
                  <Search className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  No matching results found for &ldquo;
                  <span className="text-sky-500 font-mono">{query.trim()}</span>&rdquo;
                </p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                  {query.startsWith('0x')
                    ? 'Check that the address or txn hash is correct, or enter a full 42-character address.'
                    : 'Search by Account Address (0x...), Contract Name, Token, Txn Hash, or Block Height.'}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}


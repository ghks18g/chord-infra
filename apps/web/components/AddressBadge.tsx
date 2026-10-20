'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Copy, Check, FileCode2, Shield, Server, Cpu } from 'lucide-react';
import { useAddressTags } from '../lib/address-tags';

interface AddressBadgeProps {
  address: string;
  truncate?: boolean;
  showCopy?: boolean;
  link?: boolean;
  className?: string;
  tagOnly?: boolean;
  showTag?: boolean;
}

export function AddressBadge({
  address,
  truncate = true,
  showCopy = false,
  link = true,
  className = '',
  tagOnly = false,
  showTag = false,
}: AddressBadgeProps) {
  const { getTag } = useAddressTags();
  const [copied, setCopied] = useState(false);

  if (!address) return <span className="text-slate-400 font-mono">-</span>;

  const tag = getTag(address);
  const isZero = address.toLowerCase() === '0x0000000000000000000000000000000000000000';
  const displayAddress = isZero
    ? 'Null: 0x000...000'
    : truncate
    ? `${address.slice(0, 8)}...${address.slice(-6)}`
    : address;

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCategoryBadge = () => {
    if (!tag) return null;
    const cat = tag.category?.toLowerCase() || '';

    if (cat === 'contract') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 font-sans border border-emerald-500/20">
          <FileCode2 className="h-3 w-3" />
          {tag.nameTag}
        </span>
      );
    }
    if (cat === 'precompile') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 font-sans border border-amber-500/20">
          <Cpu className="h-3 w-3" />
          {tag.nameTag}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-sans border border-slate-700/20">
        {tag.nameTag}
      </span>
    );
  };

  const content = (
    <div className={`inline-flex items-center gap-1.5 font-mono min-w-0 max-w-full ${className}`}>
      {tagOnly && tag ? (
        getCategoryBadge()
      ) : (
        <>
          <span className="text-slate-700 dark:text-slate-300 hover:text-sky-500 dark:hover:text-sky-400 transition truncate">
            {displayAddress}
          </span>
          {showTag && tag && (
            <span className="shrink-0">{getCategoryBadge()}</span>
          )}
        </>
      )}

      {showCopy && (
        <button
          onClick={handleCopy}
          type="button"
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-0.5 shrink-0"
          title="Copy Address"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      )}
    </div>
  );

  if (link) {
    return (
      <Link
        href={`/address/${address}`}
        className="inline-flex items-center hover:opacity-90 transition min-w-0 max-w-full"
      >
        {content}
      </Link>
    );
  }

  return content;
}

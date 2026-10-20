'use client';

import React from 'react';

interface TokenValueBadgeProps {
  value: string | null | undefined;
  symbol?: string;
  icon?: string;
  direction?: 'IN' | 'OUT' | null;
  className?: string;
}

export function TokenValueBadge({
  value,
  symbol = 'CHOR',
  icon = '/logo.svg',
  direction,
  className = '',
}: TokenValueBadgeProps) {
  if (value === null || value === undefined) {
    return <span className="text-slate-400 font-mono">-</span>;
  }

  let formatted = '0';
  try {
    const b = BigInt(value);
    if (b === 0n) {
      formatted = '0';
    } else {
      const chor = b / 10n ** 18n;
      const rem = b % 10n ** 18n;
      if (rem === 0n) {
        formatted = chor.toLocaleString();
      } else {
        const dec = Number(b) / 1e18;
        formatted = dec.toLocaleString(undefined, { maximumFractionDigits: 6 });
      }
    }
  } catch {
    formatted = value;
  }

  return (
    <div className={`inline-flex items-center gap-1.5 font-mono flex-nowrap ${className}`}>
      {direction === 'IN' && (
        <span className="shrink-0 inline-block rounded px-1.5 py-0.5 text-[9px] font-black uppercase font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">
          IN
        </span>
      )}
      {direction === 'OUT' && (
        <span className="shrink-0 inline-block rounded px-1.5 py-0.5 text-[9px] font-black uppercase font-mono bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:text-amber-400">
          OUT
        </span>
      )}
      {icon && (
        <img
          src={icon}
          alt={symbol}
          className="h-3.5 w-3.5 shrink-0 object-contain rounded-full border border-sky-500/20 shadow-xs"
        />
      )}
      <span className="font-semibold text-slate-900 dark:text-white">
        {formatted}
      </span>
      <span className="text-[11px] font-sans font-bold text-slate-400 dark:text-slate-500">
        {symbol}
      </span>
    </div>
  );
}

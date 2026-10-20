'use client';

import React from 'react';

interface TokenValueBadgeProps {
  value: string | null | undefined;
  symbol?: string;
  icon?: string;
  className?: string;
}

export function TokenValueBadge({
  value,
  symbol = 'CHOR',
  icon = '/logo.svg',
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
    <div className={`inline-flex items-center gap-1.5 font-mono ${className}`}>
      {icon && (
        <img
          src={icon}
          alt={symbol}
          className="h-3.5 w-3.5 shrink-0 object-contain rounded-full"
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

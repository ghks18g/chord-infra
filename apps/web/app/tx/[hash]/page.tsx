'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  Clock,
  CheckCircle2,
  ArrowLeft,
  Copy,
  Check,
  FileCode2,
  Database,
  Layers,
  ListFilter,
  FileCheck2,
  AlertTriangle,
  Coins,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { AddressBadge } from '../../../components/AddressBadge';
import { TokenValueBadge } from '../../../components/TokenValueBadge';
import {
  decodeTransactionInput,
  decodeEventLog,
  extractTokenTransfers,
  DecodedMethod,
  DecodedLog,
  DecodedParam,
  TokenTransferItem,
} from '../../../lib/abi-decoder';

interface ContractDetail {
  address: string;
  name: string | null;
  isVerified: boolean;
  isProxy?: boolean;
  proxyType?: string | null;
  implementationAddress?: string | null;
  implementation?: ContractDetail | null;
  compilerVersion: string | null;
  abi: any[] | null;
  sourceCode: string | null;
  verifiedAt: string | null;
}


interface TxDetail {
  hash: string;
  blockHeight: number;
  nonce: number;
  from: string;
  to: string | null;
  value: string;
  data: string | null;
  txType: number;
  status: string;
  createdAt: string;
  contractAddress?: string | null;
  contract?: ContractDetail | null;
  logs?: Array<{
    address: string;
    topics: string[];
    data: string;
    logIndex: string | number;
    contract?: ContractDetail | null;
  }>;
  gasUsed?: string | null;
  revertReason?: string | null;
}

export default function TxDetailPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const hash = resolvedParams.hash;

  const [tx, setTx] = useState<TxDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'state'>('overview');
  const [dataViewMode, setDataViewMode] = useState<'decoded' | 'utf8' | 'raw'>('decoded');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let attempts = 0;
    const maxAttempts = 8;

    async function fetchTx() {
      try {
        const res = await fetch(`/api/txs/${hash}`);
        if (res.ok) {
          const data = await res.json();
          setTx(data);
          setLoading(false);
          const urlParams = new URLSearchParams(window.location.search);
          const tabParam = urlParams.get('tab');
          if (tabParam === 'logs' || tabParam === 'state' || tabParam === 'overview') {
            setActiveTab(tabParam as any);
          }
          return;
        }
      } catch (err) {
        console.error(err);
      }

      attempts++;
      if (attempts < maxAttempts) {
        timer = setTimeout(fetchTx, 1500);
      } else {
        setTx(null);
        setLoading(false);
      }
    }

    setLoading(true);
    fetchTx();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [hash]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatValueChor = (valWei: string) => {
    try {
      const b = BigInt(valWei || '0');
      if (b === 0n) return '0 CHOR';
      const chor = b / 10n ** 18n;
      const rem = b % 10n ** 18n;
      if (rem === 0n) {
        return `${chor.toLocaleString()} CHOR`;
      }
      return `${(Number(b) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 6 })} CHOR`;
    } catch {
      return `${valWei} note`;
    }
  };

  if (!loading && !tx) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
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
                <ArrowLeftRight className="h-6 w-6 text-sky-500" />
                Transaction Details
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                Chord EVM Execution & CometBFT Consensus Verification
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center space-y-4 dark:border-slate-800 dark:bg-[#0D1424]">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Transaction Not Found</h2>
          <p className="text-sm text-slate-500 font-mono break-all max-w-xl mx-auto">{hash}</p>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Previous
          </button>
        </div>
      </div>
    );
  }

  const isDeploy = tx ? !tx.to : false;
  const isVerified = Boolean(tx?.contract?.isVerified);
  const contractAddress = isDeploy ? tx?.contractAddress || null : null;
  const contractName = tx?.contract?.name || null;

  const decoded = tx
    ? decodeTransactionInput(
        tx.data,
        tx.value,
        isDeploy,
        tx.contract?.abi,
        contractName,
      )
    : { name: 'Loading', signature: '', methodId: '0x', isVerified: false, params: [] };

  const logs = tx
    ? (tx.logs || []).map((log, index) => {
        const effectiveAbi =
          log.contract?.abi ||
          (log.address?.toLowerCase() === tx.to?.toLowerCase() ? tx.contract?.abi : null);
        const effectiveName =
          log.contract?.name ||
          (log.address?.toLowerCase() === tx.to?.toLowerCase() ? contractName : null);
        return decodeEventLog(log, index, effectiveAbi, effectiveName);
      })
    : [];

  const tokenTransfers = tx ? extractTokenTransfers(tx) : [];

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
              <ArrowLeftRight className="h-6 w-6 text-sky-500" />
              Transaction Details
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              Chord EVM Execution & CometBFT Consensus Verification
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-px text-sm font-semibold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-1 border-b-2 font-mono transition flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:white'
          }`}
        >
          <Layers className="h-4 w-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 px-1 border-b-2 font-mono transition flex items-center gap-2 ${
            activeTab === 'logs'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:white'
          }`}
        >
          <ListFilter className="h-4 w-4" />
          Logs / Events {loading ? '' : `(${logs.length})`}
        </button>
        <button
          onClick={() => setActiveTab('state')}
          className={`pb-3 px-1 border-b-2 font-mono transition flex items-center gap-2 ${
            activeTab === 'state'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:white'
          }`}
        >
          <Database className="h-4 w-4" />
          SMT State Trace
        </button>
      </div>

      {/* Skeleton Overview Card while Loading */}
      {loading && (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0D1424] divide-y divide-slate-100 dark:divide-slate-800/60 text-xs sm:text-sm">
          {/* Skeleton 1: Hash */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Transaction Hash
            </span>
            <div className="h-4 w-72 sm:w-96 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
          </div>
          {/* Skeleton 2: Status */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Status
            </span>
            <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-md" />
          </div>
          {/* Skeleton 3: Block */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Block
            </span>
            <div className="flex items-center gap-2">
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
              <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
            </div>
          </div>
          {/* Skeleton 4: Timestamp */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Timestamp
            </span>
            <div className="h-4 w-56 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
          </div>
          {/* Skeleton 5: From */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              From
            </span>
            <div className="h-4 w-72 sm:w-80 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
          </div>
          {/* Skeleton 6: Interacted With */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Interacted With (To)
            </span>
            <div className="h-4 w-72 sm:w-80 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
          </div>
          {/* Skeleton 7: Value */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Value
            </span>
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
          </div>
          {/* Skeleton 8: Fee */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Transaction Fee
            </span>
            <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
          </div>
        </div>
      )}

      {/* Tab Content: OVERVIEW */}
      {!loading && tx && activeTab === 'overview' && (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0D1424] divide-y divide-slate-100 dark:divide-slate-800/60 text-xs sm:text-sm">

          {/* Transaction Hash */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Transaction Hash
            </span>
            <div className="flex items-center gap-2 font-mono text-xs break-all text-slate-900 dark:text-white font-semibold">
              <span>{tx.hash}</span>
              <button
                onClick={() => copyToClipboard(tx.hash, 'hash')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                title="Copy Hash"
              >
                {copied === 'hash' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Status & Revert Reason */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Status
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              {tx.status === 'FAILED' ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                  <AlertTriangle className="h-4 w-4" />
                  Failed (Execution Reverted)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Success (EVM Executed)
                </span>
              )}
              {tx.status === 'FAILED' && tx.revertReason && (
                <div className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-xs font-mono text-rose-600 dark:text-rose-300">
                  <span>Fail with error:</span>
                  <span className="font-bold">&apos;{tx.revertReason}&apos;</span>
                </div>
              )}
            </div>
          </div>

          {/* Block Height */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Block
            </span>
            <div className="flex items-center gap-2 font-mono">
              <Link
                href={`/block/${tx.blockHeight}`}
                className="font-bold text-sky-600 hover:text-sky-500 dark:text-sky-400 hover:underline"
              >
                #{tx.blockHeight}
              </Link>
              <span className="rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 text-[10px] font-bold">
                Finalized
              </span>
            </div>
          </div>

          {/* Timestamp */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Timestamp
            </span>
            <span className="font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-slate-400" />
              {new Date(tx.createdAt).toLocaleString()} ({new Date(tx.createdAt).toISOString()})
            </span>
          </div>

          {/* From */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              From
            </span>
            <div className="flex items-center gap-2 font-mono text-xs break-all">
              <AddressBadge address={tx.from} truncate={false} showCopy={true} />
            </div>
          </div>

          {/* To / Contract Created */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              {isDeploy ? 'Contract Created' : 'Interacted With (To)'}
            </span>
            {isDeploy ? (
              <div className="flex items-center gap-2 font-mono text-xs break-all">
                {contractAddress ? (
                  <AddressBadge address={contractAddress} truncate={false} showCopy={true} showTag={true} />
                ) : (
                  <span className="text-slate-400 font-mono">Contract Creation (Pending)</span>
                )}
                {!isVerified && contractAddress && (
                  <Link
                    href={`/verify?address=${contractAddress}`}
                    className="rounded bg-sky-600 hover:bg-sky-500 text-white font-sans px-2.5 py-0.5 text-[11px] font-bold transition ml-1"
                  >
                    Verify Contract
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs break-all">
                {tx.to ? (
                  <AddressBadge address={tx.to} truncate={false} showCopy={true} showTag={true} />
                ) : (
                  <span className="text-slate-400 font-mono">-</span>
                )}
                {tx.contract?.isProxy && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[11px] text-sky-600 dark:text-sky-400 font-sans font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Proxy</span>
                    {tx.contract.implementation?.name && (
                      <span className="text-slate-500 dark:text-slate-400 font-mono">
                        → {tx.contract.implementation.name}
                      </span>
                    )}
                  </span>
                )}
              </div>

            )}
          </div>

          {/* Tokens Transferred (Etherscan standard) */}
          {tokenTransfers.length > 0 && (
            <div className="flex flex-col sm:flex-row py-4 px-6 gap-2 sm:gap-6 bg-slate-50/50 dark:bg-slate-900/40 border-y border-slate-100 dark:border-slate-800/80">
              <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0 flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-sky-500" />
                <span>Tokens Transferred</span>
              </span>
              <div className="space-y-2 flex-1 min-w-0">
                {tokenTransfers.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2.5 text-xs font-mono shadow-xs"
                  >
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold font-sans ${
                        item.type === 'NATIVE'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : item.type === 'ERC-20'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : item.type === 'ERC-721'
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                          : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                      }`}
                    >
                      {item.type}
                    </span>
                    <span className="text-slate-400">From</span>
                    <AddressBadge address={item.from} truncate={true} showCopy={true} />
                    <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="text-slate-400">To</span>
                    <AddressBadge address={item.to} truncate={true} showCopy={true} />
                    <span className="text-slate-400 font-sans font-bold">For</span>
                    {item.type === 'NATIVE' ? (
                      <TokenValueBadge value={item.value} />
                    ) : (
                      <span className="font-bold text-slate-900 dark:text-white">
                        {item.formattedValue || item.value}
                      </span>
                    )}
                    {item.tokenAddress && (
                      <span className="text-slate-400 text-[11px] flex items-center gap-1 font-sans">
                        at <AddressBadge address={item.tokenAddress} truncate={true} showCopy={false} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Value */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Value
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <TokenValueBadge value={tx.value} />
              {tx.value && tx.value !== '0' && (
                <span className="font-mono text-xs text-slate-400">
                  ({BigInt(tx.value).toLocaleString()} note)
                </span>
              )}
            </div>
          </div>

          {/* Transaction Fee */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Transaction Fee
            </span>
            <span className="font-mono text-slate-700 dark:text-slate-300">
              0.000021 CHOR <span className="text-slate-400 text-xs">(21,000 Gnote)</span>
            </span>
          </div>

          {/* Gas Price */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Gas Price
            </span>
            <span className="font-mono text-slate-700 dark:text-slate-300">
              1 Gnote <span className="text-slate-400 text-xs">(1,000,000,000 note)</span>
            </span>
          </div>

          {/* Gas Usage */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Gas Limit & Usage
            </span>
            <span className="font-mono text-slate-700 dark:text-slate-300">
              21,000 / 21,000 <span className="text-emerald-500 font-bold ml-1">(100%)</span>
            </span>
          </div>

          {/* Nonce */}
          <div className="flex flex-col sm:flex-row sm:items-center py-4 px-6 gap-2 sm:gap-6">
            <span className="w-48 text-slate-500 dark:text-slate-400 font-medium shrink-0">
              Nonce
            </span>
            <span className="font-mono text-slate-700 dark:text-slate-300">{tx.nonce}</span>
          </div>

          {/* Input Data Section with Full Decoding & Unverified Safeguard */}
          <div className="flex flex-col py-5 px-6 gap-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                Input Data & Method Decoding
              </span>
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono">
                <button
                  onClick={() => setDataViewMode('decoded')}
                  className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                    dataViewMode === 'decoded'
                      ? 'bg-white shadow-sm dark:bg-slate-800 text-sky-500 font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  Decoded
                </button>
                <button
                  onClick={() => setDataViewMode('raw')}
                  className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                    dataViewMode === 'raw'
                      ? 'bg-white shadow-sm dark:bg-slate-800 text-sky-500 font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  Original (Hex)
                </button>
                <button
                  onClick={() => setDataViewMode('utf8')}
                  className={`rounded-lg px-2.5 py-1 transition cursor-pointer ${
                    dataViewMode === 'utf8'
                      ? 'bg-white shadow-sm dark:bg-slate-800 text-sky-500 font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  UTF-8
                </button>
              </div>
            </div>

            {/* Mode 1: Decoded Parameter Table */}
            {dataViewMode === 'decoded' && (
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3.5 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-400 font-medium">Function:</span>
                  <span className="font-bold text-sky-500 dark:text-sky-400">{decoded.name}</span>
                  <span className="text-slate-400 text-[11px]">({decoded.signature})</span>
                  <span className="ml-auto rounded bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
                    MethodID: {decoded.methodId}
                  </span>
                </div>

                {!decoded.isVerified && isDeploy ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs font-mono text-amber-700 dark:text-amber-300 space-y-2">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Contract Source Code Unverified
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      This contract has not been verified yet. Method names and constructor arguments
                      can only be decoded once the Solidity source code is verified.
                    </p>
                    {contractAddress && (
                      <div className="pt-1">
                        <Link
                          href={`/verify?address=${contractAddress}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500 transition"
                        >
                          Verify Contract Code
                        </Link>
                      </div>
                    )}
                  </div>
                ) : decoded.params.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50 text-[11px] uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-4 py-2.5">#</th>
                          <th className="px-4 py-2.5">Name</th>
                          <th className="px-4 py-2.5">Type</th>
                          <th className="px-4 py-2.5">Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {decoded.params.map((param, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="px-4 py-3 text-slate-400">{idx}</td>
                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                              {param.name}
                            </td>
                            <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400">
                              {param.type}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white break-all">
                              {param.type === 'address' ? (
                                <AddressBadge address={param.value} truncate={false} showCopy={true} />
                              ) : (
                                param.value
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center text-slate-400">
                    No additional parameters to decode.
                  </div>
                )}
              </div>
            )}

            {/* Mode 2: Raw Hex */}
            {dataViewMode === 'raw' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>
                    Payload Size:{' '}
                    <strong className="text-slate-300">
                      {Math.max(0, ((tx.data || '0x').length - 2) / 2).toLocaleString()} bytes
                    </strong>{' '}
                    ({(tx.data || '0x').length.toLocaleString()} characters)
                  </span>
                  <button
                    onClick={() => copyToClipboard(tx.data || '0x', 'rawdata')}
                    className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                  >
                    {copied === 'rawdata' ? '✓ Copied' : 'Copy Hex Bytecode'}
                  </button>
                </div>
                <pre className="rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-200 border border-slate-800 break-all max-h-56 overflow-y-auto select-all">
                  <code>{tx.data || '0x'}</code>
                </pre>
              </div>
            )}

            {/* Mode 3: UTF-8 */}
            {dataViewMode === 'utf8' && (
              <pre className="rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-300 border border-slate-800 break-all max-h-48 overflow-y-auto">
                <code>
                  {(() => {
                    try {
                      const hexStr = (tx.data || '').replace(/^0x/, '');
                      return hexStr ? Buffer.from(hexStr, 'hex').toString('utf8') : '(empty)';
                    } catch {
                      return '(binary / non-utf8 data)';
                    }
                  })()}
                </code>
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: LOGS / EVENTS */}
      {!loading && tx && activeTab === 'logs' && (
        <div className="space-y-4 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center text-slate-400 dark:border-slate-800 dark:bg-[#0D1424]">
              No event logs emitted in this transaction.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.logIndex}
                className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0D1424] space-y-4"
              >
                {/* Event Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-1 text-xs font-bold">
                      Log #{log.logIndex}
                    </span>
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      {log.eventName}
                    </span>
                    {log.isStandard && (
                      <span className="rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold font-sans">
                        {log.standardType} Standard
                      </span>
                    )}
                    <span className="text-slate-400 text-xs">({log.signature})</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400">Address:</span>
                    <AddressBadge address={log.address} truncate={false} showCopy={true} />
                  </div>
                </div>

                {/* If standard EIP token event, show standard confirmation notice */}
                {log.isStandard ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 font-sans">
                    <Sparkles className="h-4 w-4 shrink-0 text-emerald-500" />
                    <span>
                      이 이벤트는 전역 표준 EIP 규격({log.standardType} Specification)에 따라 자동으로 파싱되었습니다.
                    </span>
                  </div>
                ) : !log.isVerified ? (
                  /* Custom event on unverified contract: display verification prompt */
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                      <span>
                        Contract is not verified. Custom event signatures and parameters cannot be decoded
                        without verified ABI.
                      </span>
                    </div>
                    <Link
                      href={`/verify?address=${log.address}`}
                      className="rounded bg-sky-600 hover:bg-sky-500 text-white font-sans px-2.5 py-1 text-[11px] font-bold transition shrink-0"
                    >
                      Verify Contract
                    </Link>
                  </div>
                ) : null}

                {/* Decoded Event Parameters (when verified or standard EIP token event) */}
                {(log.isVerified || log.isStandard) && log.decodedArgs && log.decodedArgs.length > 0 && (
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-2">
                      Decoded Parameters
                    </span>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/80">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[11px] uppercase">
                          <tr>
                            <th className="px-4 py-2">Parameter</th>
                            <th className="px-4 py-2">Type</th>
                            <th className="px-4 py-2">Indexed</th>
                            <th className="px-4 py-2">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {log.decodedArgs.map((arg, idx) => (
                            <tr
                              key={idx}
                              className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                            >
                              <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                                {arg.name}
                              </td>
                              <td className="px-4 py-2.5 text-emerald-500">{arg.type}</td>
                              <td className="px-4 py-2.5">
                                {arg.indexed ? (
                                  <span className="rounded bg-sky-500/10 text-sky-400 px-1.5 py-0.5 text-[10px] font-bold">
                                    true
                                  </span>
                                ) : (
                                  <span className="text-slate-500">false</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white break-all">
                                {arg.type === 'address' ? (
                                  <AddressBadge address={arg.value} truncate={false} showCopy={true} />
                                ) : (
                                  arg.value
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Topics Accordion */}
                <div className="space-y-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
                    Topics ({log.topics.length})
                  </span>
                  <div className="rounded-xl bg-slate-950 p-3 space-y-1 text-slate-300 border border-slate-800">
                    {log.topics.map((topic, tIdx) => (
                      <div key={tIdx} className="flex items-start gap-2 break-all text-[11px]">
                        <span className="text-slate-500 shrink-0 font-bold">[{tIdx}]</span>
                        <span>{topic}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data */}
                {log.data && log.data !== '0x' && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
                      Data (Raw Hex)
                    </span>
                    <pre className="rounded-xl bg-slate-950 p-3 text-[11px] text-slate-300 border border-slate-800 break-all overflow-x-auto">
                      <code>{log.data}</code>
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content: STATE TRACE */}
      {!loading && tx && activeTab === 'state' && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0D1424] space-y-4 font-mono text-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            CometBFT ZK Sparse Merkle Tree (SMT) State Commit
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            This transaction was finalized with sub-second deterministic finality and updated the
            256-depth Poseidon SMT root.
          </p>
          <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 space-y-2 text-slate-300">
            <div>
              <span className="text-slate-500">Block Height:</span> #{tx.blockHeight}
            </div>
            <div>
              <span className="text-slate-500">Sender Balance Updated:</span> Account state
              transition confirmed
            </div>
            <div>
              <span className="text-slate-500">Zero-Knowledge Verification:</span> Compatible with
              EIP-712 / EIP-1271 SMT inclusion proofs
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

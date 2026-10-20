'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileCode2,
  Wallet,
  CheckCircle2,
  ArrowLeft,
  Copy,
  Check,
  ShieldCheck,
  Code2,
  Play,
  Send,
  ExternalLink,
  Coins,
  Package,
  ChevronRight,
  Layers,
  ArrowLeftRight,
  AlertCircle,
} from 'lucide-react';
import { AddressBadge } from '../../../components/AddressBadge';
import { TokenValueBadge } from '../../../components/TokenValueBadge';
import { ContractInteraction } from '../../../components/ContractInteraction';

interface TokenHolding {
  tokenAddress: string;
  tokenName: string;
  tokenStandard: string;
  tokenId: string;
  balance: string;
}

interface AddressData {
  address: string;
  balance: string;
  stateRoot: string;
  isContract: boolean;
  bytecode?: string | null;
  contract?: any;
  proxy?: {
    isProxy: boolean;
    proxyType?: string;
    implementationAddress: string;
    implementationName?: string | null;
    implementationVerified?: boolean;
  } | null;
  tag?: any;
  zkProof?: any;
  recentTransactions?: any[];
  internalTransactions?: any[];
  tokenTransfers?: any[];
  tokenHoldings?: TokenHolding[];
}


export default function AddressDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const address = resolvedParams.address;
  const isValidAddress = /^0x[0-9a-fA-F]{40}$/.test(address);

  const [data, setData] = useState<AddressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'txs' | 'internal' | 'tokens' | 'contract'>('txs');
  const [contractSubTab, setContractSubTab] = useState<'code' | 'read' | 'write'>('read');

  useEffect(() => {
    async function fetchAddressDetail() {
      if (!isValidAddress) {
        setError(`"${address}" is not a valid 42-character EVM address format.`);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/address/${address}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
          const urlParams = new URLSearchParams(window.location.search);
          const tabParam = urlParams.get('tab');
          if (tabParam === 'internal' || tabParam === 'tokens' || tabParam === 'contract' || tabParam === 'txs') {
            setActiveTab(tabParam);
          } else if (json.isContract) {
            setActiveTab('contract');
          }
        } else {
          const errJson = await res.json().catch(() => ({}));
          setError(errJson.message || `Address "${address}" could not be loaded.`);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to connect to the indexing server.');
      } finally {
        setLoading(false);
      }
    }
    fetchAddressDetail();
  }, [address, isValidAddress]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatBalanceNum = (weiStr: string) => {
    try {
      if (!weiStr || weiStr === '0' || weiStr === '0x' || weiStr === '0x0') return '0';
      const b = BigInt(weiStr);
      const chor = b / 10n ** 18n;
      const rem = b % 10n ** 18n;
      if (rem === 0n) return chor.toLocaleString();
      const dec = Number(b) / 1e18;
      return dec.toLocaleString(undefined, { maximumFractionDigits: 6 });
    } catch {
      return '0';
    }
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

  if (!loading && (error || !isValidAddress)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <AlertCircle className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Invalid Address Format
          </h1>
          <p className="text-sm font-mono text-slate-500 dark:text-slate-400 break-all max-w-lg mx-auto">
            {error || `"${address}" is not a valid 42-character EVM address.`}
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Chord addresses must begin with 0x followed by exactly 40 hexadecimal characters (20 bytes).
          </p>
        </div>
        <div className="pt-4 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-sky-500/20 hover:from-sky-400 hover:to-indigo-500 transition cursor-pointer"
          >
            Back to Explorer
          </Link>
          <Link
            href="/tokens"
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Explore Tokens
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60 transition cursor-pointer"
            title="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                {loading ? (
                  <Wallet className="h-6 w-6 text-sky-500/60 animate-pulse" />
                ) : data?.isContract ? (
                  <FileCode2 className="h-6 w-6 text-sky-500" />
                ) : (
                  <Wallet className="h-6 w-6 text-sky-500" />
                )}
                {loading ? 'Address' : data?.isContract ? 'Contract' : 'Address'}
              </h1>
              <span className="font-mono text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 break-all">
                {address}
              </span>
              {!loading && <AddressBadge address={address} link={false} tagOnly={true} />}
              <button
                onClick={() => copyToClipboard(address, 'addr')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Copy Address"
              >
                {copied === 'addr' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
              Chord EVM State & Live Account On-Chain Details
            </p>
          </div>
        </div>

        {!loading && data?.isContract && (!data?.contract || !data?.contract.isVerified) && (
          <Link
            href={`/verify?address=${address}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-500 transition self-start sm:self-auto shadow-sm"
          >
            <FileCode2 className="h-3.5 w-3.5" />
            Verify Contract Code
          </Link>
        )}
      </div>

      {/* Account Balance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Balance Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0D1424]">
          <span className="text-xs font-semibold uppercase text-slate-400 block mb-1">
            CHOR Balance
          </span>
          {loading ? (
            <div className="space-y-2 mt-2">
              <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
              <div className="h-3.5 w-48 bg-slate-100 dark:bg-slate-800/60 animate-pulse rounded" />
            </div>
          ) : (
            <>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-black text-slate-900 dark:text-white">
                  {formatBalanceNum(data?.balance || '0')}
                </span>
                <span className="text-xs font-bold text-sky-500 font-mono">CHOR</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400 block mt-2 truncate">
                {data?.balance || '0'} note (Live eth_getBalance)
              </span>
            </>
          )}
        </div>

        {/* Token Holdings Card */}
        <div
          onClick={() => setActiveTab('tokens')}
          className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0D1424] cursor-pointer hover:border-sky-400 dark:hover:border-sky-500/50 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400 block mb-1">
              Token Holdings
            </span>
            <span className="text-[10px] font-mono text-sky-500 flex items-center group-hover:underline">
              View All <ChevronRight className="h-3 w-3" />
            </span>
          </div>
          {loading ? (
            <div className="space-y-2 mt-2">
              <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
              <div className="h-3.5 w-36 bg-slate-100 dark:bg-slate-800/60 animate-pulse rounded" />
            </div>
          ) : (
            <>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-black text-slate-900 dark:text-white">
                  {data?.tokenHoldings?.length || 0}
                </span>
                <span className="text-xs font-bold text-indigo-500 font-mono">Assets</span>
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-2 font-mono">
                {data?.tokenHoldings && data.tokenHoldings.length > 0
                  ? data.tokenHoldings.map((h) => `${h.tokenName} (${h.balance})`).join(', ')
                  : 'No tokens held'}
              </div>
            </>
          )}
        </div>

        {/* Account Type Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0D1424]">
          <span className="text-xs font-semibold uppercase text-slate-400 block mb-1">
            Account Type
          </span>
          {loading ? (
            <div className="space-y-2.5 mt-2">
              <div className="h-7 w-40 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-md" />
              <div className="h-3.5 w-36 bg-slate-100 dark:bg-slate-800/60 animate-pulse rounded" />
            </div>
          ) : (
            <>
              <div className="mt-2 flex items-center gap-2">
                {data?.isContract ? (
                  <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${
                    data?.contract?.isVerified
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                  }`}>
                    <FileCode2 className="h-4 w-4" />
                    {data?.contract?.isVerified ? 'Smart Contract (Verified)' : 'Smart Contract (Unverified)'}
                  </span>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 self-start">
                      <Wallet className="h-4 w-4" />
                      EOA (Externally Owned Account)
                    </span>
                    <AddressBadge address={address} link={false} tagOnly={true} />
                  </div>
                )}
              </div>
              <span className="text-[11px] text-slate-400 block mt-3">
                {data?.isContract
                  ? data?.contract?.isVerified
                    ? 'Verified Source Code Available'
                    : 'Bytecode Deployed (Unverified)'
                  : data?.tag?.description || 'Standard EVM Account'}
              </span>
            </>
          )}
        </div>

        {/* State Root Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0D1424]">
          <span className="text-xs font-semibold uppercase text-slate-400 block mb-1">
            CometBFT State Root
          </span>
          {loading ? (
            <div className="space-y-2.5 mt-2">
              <div className="h-5 w-52 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
              <div className="h-3.5 w-28 bg-slate-100 dark:bg-slate-800/60 animate-pulse rounded mt-3" />
            </div>
          ) : (
            <>
              <div className="mt-1 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                {data?.stateRoot || '0x0d7c...'}
              </div>
              <span className="text-[11px] text-slate-400 block mt-3 font-mono">
                Chain ID: 7613 (0x1dbd)
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex gap-4 text-sm font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('txs')}
          className={`pb-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'txs'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          Transactions {loading ? '' : `(${data?.recentTransactions?.length || 0})`}
        </button>

        <button
          onClick={() => setActiveTab('internal')}
          className={`pb-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'internal'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          Internal Txns {loading ? '' : `(${data?.internalTransactions?.length || 0})`}
        </button>

        <button
          onClick={() => setActiveTab('tokens')}
          className={`pb-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'tokens'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          Token Transfers {loading ? '' : `(${data?.tokenTransfers?.length || 0})`}
        </button>

        {(data?.isContract || loading) && (
          <button
            onClick={() => setActiveTab('contract')}
            className={`pb-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'contract'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {data?.contract?.isVerified ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <FileCode2 className="h-4 w-4 text-amber-500" />
            )}
            Contract Code {data?.contract?.isVerified ? '& ABI' : '(Unverified)'}
          </button>
        )}
      </div>

      {/* Skeleton Table while Loading */}
      {loading && (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0D1424] overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
            <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
                  <div className="h-4 w-12 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
                </div>
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
                <div className="flex items-center gap-2">
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
                </div>
                <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 1: Transactions */}
      {!loading && activeTab === 'txs' && (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0D1424] overflow-hidden">
          {!data?.recentTransactions || data.recentTransactions.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400 space-y-1">
              <p>No transactions associated with this address.</p>
              <p className="font-mono text-slate-500">
                New on-chain transactions will be indexed automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto font-mono text-xs">
              <table className="w-full text-left">
                <thead className="border-b border-slate-100 bg-slate-50/50 text-slate-600 dark:border-slate-800/80 dark:bg-slate-900/40 dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3">Transaction Hash</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Block</th>
                    <th className="py-2.5 px-3">From</th>
                    <th className="py-2.5 px-3">To</th>
                    <th className="py-2.5 px-3 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {data.recentTransactions.map((tx: any) => {
                    const isSender = tx.from?.toLowerCase() === address.toLowerCase();
                    const isReceiver = tx.to?.toLowerCase() === address.toLowerCase();
                    const isSelf = isSender && isReceiver;
                    const direction = isSelf ? 'SELF' : isSender ? 'OUT' : 'IN';

                    return (
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
                          <Link href={`/block/${tx.blockHeight}`} className="hover:underline text-slate-600 dark:text-slate-400">
                            #{tx.blockHeight}
                          </Link>
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
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <span className={`shrink-0 inline-block rounded px-1.5 py-0.5 text-[9px] font-black uppercase font-mono ${
                              direction === 'IN'
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400'
                                : direction === 'OUT'
                                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:text-amber-400'
                                : 'bg-slate-500/10 text-slate-600 border border-slate-500/20 dark:text-slate-400'
                            }`}>
                              {direction}
                            </span>
                            <TokenValueBadge value={tx.value} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Internal Transactions */}
      {!loading && activeTab === 'internal' && (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0D1424] overflow-hidden">
          {!data?.internalTransactions || data.internalTransactions.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400 space-y-1">
              <p>No contract internal transactions found for this address.</p>
              <p className="font-mono text-slate-500">
                Internal native value transfers (e.g. Faucet claims, contract calls) will be displayed here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto font-mono text-xs">
              <table className="w-full text-left">
                <thead className="border-b border-slate-100 bg-slate-50/50 text-slate-600 dark:border-slate-800/80 dark:bg-slate-900/40 dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3">Parent Tx Hash</th>
                    <th className="py-2.5 px-3">Block</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">From</th>
                    <th className="py-2.5 px-3">To</th>
                    <th className="py-2.5 px-3 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {data.internalTransactions.map((itx: any, idx: number) => {
                    const direction = itx.direction || (itx.to?.toLowerCase() === address.toLowerCase() ? 'IN' : 'OUT');
                    return (
                      <tr key={`${itx.parentTxHash}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-2.5 px-3">
                          <Link href={`/tx/${itx.parentTxHash}`} className="text-sky-600 dark:text-sky-400 hover:underline">
                            {itx.parentTxHash.slice(0, 16)}...
                          </Link>
                        </td>
                        <td className="py-2.5 px-3">
                          <Link href={`/block/${itx.blockHeight}`} className="hover:underline text-slate-600 dark:text-slate-400">
                            #{itx.blockHeight}
                          </Link>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center rounded border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold font-sans text-purple-600 dark:text-purple-400">
                            {itx.type || 'call'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {itx.from ? <AddressBadge address={itx.from} /> : '-'}
                        </td>
                        <td className="py-2.5 px-3">
                          {itx.to ? <AddressBadge address={itx.to} /> : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <span className={`shrink-0 inline-block rounded px-1.5 py-0.5 text-[9px] font-black uppercase font-mono ${
                              direction === 'IN'
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400'
                                : direction === 'OUT'
                                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:text-amber-400'
                                : 'bg-slate-500/10 text-slate-600 border border-slate-500/20 dark:text-slate-400'
                            }`}>
                              {direction}
                            </span>
                            <TokenValueBadge value={itx.value} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Token Holdings & Transfers */}
      {!loading && activeTab === 'tokens' && (
        <div className="space-y-6">
          {/* Section 1: Current Asset Holdings */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0D1424] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-sky-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Current Token Holdings ({data?.tokenHoldings?.length || 0})
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Net Balances from Indexed Transfers
              </span>
            </div>

            {!data?.tokenHoldings || data.tokenHoldings.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 font-mono">
                No ERC-20, ERC-721, or ERC-1155 token balances held by this address.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {data.tokenHoldings.map((h, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40 space-y-2 hover:border-sky-400 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-bold font-mono bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
                        {h.tokenStandard}
                      </span>
                      <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                        Qty: {h.balance}
                      </span>
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {h.tokenName}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                        Token ID #{h.tokenId}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-mono">
                      <Link
                        href={`/address/${h.tokenAddress}`}
                        className="text-sky-600 dark:text-sky-400 hover:underline truncate block"
                      >
                        {h.tokenAddress.slice(0, 10)}...{h.tokenAddress.slice(-6)}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Token Transfers History */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0D1424] overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-sky-500" />
                Token Transfer History
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {data?.tokenTransfers?.length || 0} Transfers Recorded
              </span>
            </div>
            {!data?.tokenTransfers || data.tokenTransfers.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 space-y-1">
                <p>No token transfers (ERC-20, ERC-721, ERC-1155) found for this address.</p>
                <p className="font-mono text-slate-500">
                  Any fungible and non-fungible token interactions will be indexed here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto font-mono text-xs">
                <table className="w-full text-left">
                <thead className="border-b border-slate-100 bg-slate-50/50 text-slate-600 dark:border-slate-800/80 dark:bg-slate-900/40 dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3">Txn Hash</th>
                    <th className="py-2.5 px-3">Block</th>
                    <th className="py-2.5 px-3">Standard</th>
                    <th className="py-2.5 px-3">From</th>
                    <th className="py-2.5 px-2 text-center"></th>
                    <th className="py-2.5 px-3">To</th>
                    <th className="py-2.5 px-3 text-right">Value / Token ID</th>
                    <th className="py-2.5 px-3">Token Contract</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {data.tokenTransfers.map((tt: any, idx: number) => {
                    const direction = tt.direction || (tt.to?.toLowerCase() === address.toLowerCase() ? 'IN' : 'OUT');
                    return (
                      <tr key={`${tt.txHash}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-2.5 px-3">
                          <Link href={`/tx/${tt.txHash}`} className="text-sky-600 dark:text-sky-400 hover:underline">
                            {tt.txHash.slice(0, 16)}...
                          </Link>
                        </td>
                        <td className="py-2.5 px-3">
                          <Link href={`/block/${tt.blockHeight}`} className="hover:underline text-slate-600 dark:text-slate-400">
                            #{tt.blockHeight}
                          </Link>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold font-sans text-emerald-600 dark:text-emerald-400">
                            {tt.tokenStandard}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {tt.from ? <AddressBadge address={tt.from} /> : '-'}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-black uppercase font-mono ${
                            direction === 'IN'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400'
                              : direction === 'OUT'
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:text-amber-400'
                              : 'bg-slate-500/10 text-slate-600 border border-slate-500/20 dark:text-slate-400'
                          }`}>
                            {direction}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {tt.to ? <AddressBadge address={tt.to} /> : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white">
                          {tt.value}
                        </td>
                        <td className="py-2.5 px-3">
                          {tt.tokenAddress ? <AddressBadge address={tt.tokenAddress} /> : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )}

      {/* Tab 4: Contract Details & Source Code / Read / Write */}
      {!loading && activeTab === 'contract' && data?.isContract && (
        <div className="space-y-6">
          {data.contract?.isVerified ? (
            <div className="space-y-6">
              {/* Proxy Contract Banner if EIP-1967/UUPS Proxy */}
              {data.proxy?.isProxy && (
                <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5 text-sky-800 dark:text-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="rounded-xl bg-sky-500/20 p-2.5 text-sky-400 shrink-0">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 font-bold text-sm text-sky-950 dark:text-sky-100">
                        <span>{data.proxy.proxyType || 'ERC-1967'} Proxy Contract</span>
                        <span className="rounded bg-sky-500/20 border border-sky-500/30 px-2 py-0.5 text-[10px] font-mono text-sky-600 dark:text-sky-300">
                          Proxy Verified
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 font-mono mt-1 flex items-center gap-2 flex-wrap">
                        <span className="text-slate-400">Implementation:</span>
                        <Link
                          href={`/address/${data.proxy.implementationAddress}`}
                          className="text-sky-600 dark:text-sky-400 font-bold hover:underline"
                        >
                          {data.proxy.implementationAddress}
                        </Link>
                        {data.proxy.implementationName && (
                          <span className="rounded bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-700 dark:text-slate-300">
                            {data.proxy.implementationName}
                          </span>
                        )}
                        {data.proxy.implementationVerified && (
                          <span className="text-emerald-500 font-sans font-semibold text-[11px] flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Implementation Verified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/address/${data.proxy.implementationAddress}?tab=contract`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-500 transition shadow-sm shrink-0 self-start sm:self-auto"
                  >
                    <span>View Implementation</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              {/* Verified Contract Header Card */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0D1424]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <span>{data.contract.name || 'Verified Contract'}</span>
                      <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        Exact Bytecode Match
                      </span>
                    </h3>
                    <div className="text-xs text-slate-400 font-mono mt-1 flex flex-wrap items-center gap-3">
                      <span>Compiler: {data.contract.compilerVersion || 'v0.8.20'}</span>
                      <span>·</span>
                      <span>Optimization: Enabled (200 runs)</span>
                      <span>·</span>
                      <span>EVM: Cancun / Paris 호환</span>
                    </div>
                  </div>
                </div>
              </div>


              {/* Sub-tabs: Code | Read Contract (조회) | Write Contract (온체인 제출) */}
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-px text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setContractSubTab('code')}
                  className={`pb-2.5 px-3 border-b-2 font-mono transition flex items-center gap-1.5 cursor-pointer ${
                    contractSubTab === 'code'
                      ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  <span>Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => setContractSubTab('read')}
                  className={`pb-2.5 px-3 border-b-2 font-mono transition flex items-center gap-1.5 cursor-pointer ${
                    contractSubTab === 'read'
                      ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Read Contract (조회)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setContractSubTab('write')}
                  className={`pb-2.5 px-3 border-b-2 font-mono transition flex items-center gap-1.5 cursor-pointer ${
                    contractSubTab === 'write'
                      ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Write Contract (온체인 제출)</span>
                </button>
              </div>

              {/* Sub-tab 1: Code */}
              {contractSubTab === 'code' && (
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0D1424] space-y-5">
                  {/* Source Code Box */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase text-slate-400 font-mono">
                        Contract Source Code (Solidity)
                      </span>
                      <button
                        onClick={() => copyToClipboard(data.contract.sourceCode || '', 'src')}
                        className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-500 dark:text-sky-400 cursor-pointer"
                      >
                        {copied === 'src' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>Copy Code</span>
                      </button>
                    </div>
                    <pre className="rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-200 overflow-x-auto max-h-96 border border-slate-800">
                      <code>{data.contract.sourceCode}</code>
                    </pre>
                  </div>

                  {/* ABI Box */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase text-slate-400 font-mono">
                        Contract ABI
                      </span>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(data.contract.abi || [], null, 2), 'abi')}
                        className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-500 dark:text-sky-400 cursor-pointer"
                      >
                        {copied === 'abi' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>Copy ABI</span>
                      </button>
                    </div>
                    <pre className="rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-60 border border-slate-800">
                      <code>{JSON.stringify(data.contract.abi, null, 2)}</code>
                    </pre>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Read Contract (조회) */}
              {contractSubTab === 'read' && (
                <ContractInteraction
                  contractAddress={address}
                  abi={data.contract.abi}
                  contractName={data.contract.name}
                  mode="read"
                />
              )}

              {/* Sub-tab 3: Write Contract (온체인 제출) */}
              {contractSubTab === 'write' && (
                <ContractInteraction
                  contractAddress={address}
                  abi={data.contract.abi}
                  contractName={data.contract.name}
                  mode="write"
                />
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0D1424] space-y-6">
              {/* Unverified Banner */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-800 dark:text-amber-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <FileCode2 className="h-5 w-5 text-amber-500" />
                  Contract Source Code Unverified
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Are you the contract creator? Verify and publish your Solidity source code to decode methods, constructor parameters, and event logs across ChordScan.
                </p>
                <div>
                  <Link
                    href={`/verify?address=${address}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500 transition shadow-sm"
                  >
                    <FileCode2 className="h-4 w-4" />
                    Verify and Publish Contract Code
                  </Link>
                </div>
              </div>

              {/* Deployed Bytecode Viewer */}
              <div>
                <span className="text-xs font-semibold uppercase text-slate-400 block mb-2 font-mono">
                  Deployed Bytecode (On-Chain)
                </span>
                <pre className="rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-64 border border-slate-800 break-all select-all">
                  <code>{data.bytecode || data.contract?.bytecode || '0x'}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

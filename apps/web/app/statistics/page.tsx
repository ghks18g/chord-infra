'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Activity,
  Box,
  ShieldCheck,
  Cpu,
  Layers,
  Database,
  Timer,
  Fuel,
  Check,
  Copy,
  Wallet,
  ExternalLink,
  Radio,
} from 'lucide-react';

interface NetworkStats {
  latestBlockHeight: number;
  latestStateRoot: string;
  activeValidators: number;
  network: string;
  evmChainId: number;
  nodeVersion: string;
  consensus: string;
  gasPrice: string;
}

export default function StatisticsPage() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [txCount, setTxCount] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error(err));

    fetch('/api/txs?limit=1')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTxCount(data.length);
      })
      .catch((err) => console.error(err));
  }, []);

  const copyRpcUrl = () => {
    navigator.clipboard.writeText('https://rpc.chordchain.space');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addNetworkToWallet = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      alert('설치된 Web3 브라우저 지갑(MetaMask 등)을 찾을 수 없습니다.');
      return;
    }
    try {
      await (window as any).ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0x1dbd', // 7613
            chainName: 'CHORD L1',
            nativeCurrency: {
              name: 'CHOR',
              symbol: 'CHOR',
              decimals: 18,
            },
            rpcUrls: ['https://rpc.chordchain.space'],
            blockExplorerUrls: ['https://scan.chordchain.space'],
          },
        ],
      });
    } catch (err: any) {
      console.error('Failed to add CHORD network to wallet:', err);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Title & Breadcrumb */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-sky-500">Home</Link>
          <span>/</span>
          <span className="text-slate-700 dark:text-slate-300">Analytics</span>
          <span>/</span>
          <span className="text-sky-600 dark:text-sky-400 font-semibold">Statistics</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-sky-500" />
              Network Statistics
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              CHORD L1 블록체인의 실시간 처리 용량, 블록 완결성, 가스 지표 및 공식 RPC 네트워크 연동 정보
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>CometBFT Consensus Active</span>
          </div>
        </div>
      </div>

      {/* 4 Core Performance KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: TPS Capacity */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0D1424]">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>최대 처리 용량 (Peak Capacity)</span>
            <Activity className="h-4 w-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-slate-900 dark:text-white">
            4,000 TPS
          </div>
          <div className="mt-2 text-[11px] font-mono text-sky-600 dark:text-sky-400 font-semibold">
            온디맨드 서브세컨드 BFT
          </div>
        </div>

        {/* KPI 2: Block Finality */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0D1424]">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>블록 완결 지연 (Finality)</span>
            <Timer className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
            &lt; 0.8s
          </div>
          <div className="mt-2 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
            단일 블록 즉시 확정 (Zero-Fork)
          </div>
        </div>

        {/* KPI 3: Base Gas Tracker */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0D1424]">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>기준 가스비 (Gas Tracker)</span>
            <Fuel className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-slate-900 dark:text-white">
            1 Gnote
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            1,000,000,000 note (Fixed Base Fee)
          </div>
        </div>

        {/* KPI 4: Quorum Health */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0D1424]">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>합의 정족수 건전성 (Quorum)</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            100%
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            4 / 4 Validators Active (f = 1)
          </div>
        </div>
      </div>

      {/* Grid of Detailed Metrics Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Throughput & Consensus Profile */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0D1424] space-y-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-sky-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              합의 엔진 및 블록 생성 프로필
            </h2>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">합의 엔진 (Consensus Engine)</span>
              <span className="font-bold text-slate-900 dark:text-white">CometBFT v0.38 (PoS BFT)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">블록 생성 정책 (Block Creation)</span>
              <span className="font-bold text-sky-600 dark:text-sky-400">On-demand (create_empty_blocks = false)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">블록당 가스 한도 (Block Gas Limit)</span>
              <span className="font-bold text-slate-900 dark:text-white">30,000,000 Gas</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">정족수 조건 (Quorum Threshold)</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">&gt;= 75% (3/4 밸리데이터)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">최신 블록 높이 (Latest Block)</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">#{stats?.latestBlockHeight ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Panel 2: Storage & State Architecture */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0D1424] space-y-5">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              상태 트리 및 스토리지 구조
            </h2>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">상태 머신 구조 (State Machine)</span>
              <span className="font-bold text-slate-900 dark:text-white">Sparse Merkle Tree (SMT, Depth 256)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">상태 트리 해시 (Tree Hash)</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">Poseidon Hash</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">ZK 서킷 연산 최적화 (ZK Optimization)</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">ZK 친화적 해시 (~240 Constraints)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">영속 스토리지 관리 (Storage Management)</span>
              <span className="font-bold text-slate-900 dark:text-white">상태 정리 엔진 (State Pruning Engine)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">메타트랜잭션 지원 (Gasless Support)</span>
              <span className="font-bold text-sky-600 dark:text-sky-400">EIP-712 & EIP-2771 Forwarder</span>
            </div>
          </div>
        </div>
      </div>

      {/* Official RPC Endpoint Integration Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0D1424] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <Radio className="h-6 w-6 text-sky-500" />
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                CHORD L1 공식 RPC 네트워크 연동 가이드
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                MetaMask, Rabby 등 EVM 호환 지갑 또는 개발 도구(Hardhat, Foundry, viem, ethers)에 연결하여 사용하세요.
              </p>
            </div>
          </div>
          <button
            onClick={addNetworkToWallet}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:from-sky-600 hover:to-indigo-700 transition shrink-0"
          >
            <Wallet className="h-4 w-4" />
            <span>지갑에 CHORD 체인 추가</span>
          </button>
        </div>

        {/* RPC Parameters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          {/* Item 1: Network Name */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 space-y-1">
            <div className="text-[11px] text-slate-400 font-sans">Network Name</div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">CHORD L1</div>
          </div>

          {/* Item 2: RPC URL with Copy */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 space-y-1">
            <div className="text-[11px] text-slate-400 font-sans flex items-center justify-between">
              <span>RPC URL</span>
              <button
                onClick={copyRpcUrl}
                className="text-sky-600 dark:text-sky-400 hover:opacity-80 flex items-center gap-1 font-mono text-[10px]"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? '복사됨' : '복사'}</span>
              </button>
            </div>
            <div className="font-bold text-sky-600 dark:text-sky-400 truncate">
              https://rpc.chordchain.space
            </div>
          </div>

          {/* Item 3: Chain ID */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 space-y-1">
            <div className="text-[11px] text-slate-400 font-sans">Chain ID</div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              7613 <span className="text-slate-400 font-normal text-xs">(0x1dbd)</span>
            </div>
          </div>

          {/* Item 4: Currency Symbol */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 space-y-1">
            <div className="text-[11px] text-slate-400 font-sans">Currency Symbol</div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              CHOR <span className="text-slate-400 font-normal text-xs">(18 Decimals)</span>
            </div>
          </div>
        </div>

        {/* Explorer URL row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-sky-500/5 border border-sky-500/20 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Block Explorer URL:</span>
            <code className="font-mono text-sky-600 dark:text-sky-400 font-bold">https://scan.chordchain.space</code>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/verify"
              className="text-sky-600 dark:text-sky-400 hover:underline font-semibold flex items-center gap-1"
            >
              <span>스마트 컨트랙트 검증</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

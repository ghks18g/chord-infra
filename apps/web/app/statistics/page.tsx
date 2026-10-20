'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Activity,
  Zap,
  Box,
  ShieldCheck,
  Cpu,
  Layers,
  Database,
  Timer,
  Fuel,
  LineChart,
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
              <BarChart3 className="h-8 w-8 text-indigo-500" />
              Network Statistics
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Chord L1 App-Chain capacity, block finality, gas metrics, and SMT efficiency
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-600 dark:text-sky-400 font-mono">
            <span>CometBFT Engine Active</span>
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
            즉각 단일 블록 확정 (Zero-Fork)
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
            1,000,000,000 note (1 Gnote Fixed Base)
          </div>
        </div>

        {/* KPI 4: Quorum Health */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0D1424]">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>합의 건전성 (Quorum Health)</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            100%
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            4 / 4 Nodes Active (f = 1)
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
              트랜잭션 처리량 및 합의 프로필
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
              <span className="text-slate-500 dark:text-slate-400">최대 블록 가스 한도 (Block Gas Limit)</span>
              <span className="font-bold text-slate-900 dark:text-white">30,000,000 Gas</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">합의 정족수 조건 (Quorum Threshold)</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">&gt;= 75% (3/4 Validators)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">총 확정 블록 수 (Committed Blocks)</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">#{stats?.latestBlockHeight ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Panel 2: Storage & ZK Tree Architecture */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0D1424] space-y-5">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              상태 트리 및 스토리지 효율성
            </h2>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">상태 트리 구조 (State Machine)</span>
              <span className="font-bold text-slate-900 dark:text-white">Sparse Merkle Tree (SMT, Depth 256)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">트리 해시 함수 (Tree Hash)</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">Poseidon Hash (유한체 최적화)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">ZK 제약조건 절감률 (Constraint Reduction)</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">~240 vs ~30,000 (99.2% 절감)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">디스크 용량 제약 정책 (Storage Quota)</span>
              <span className="font-bold text-slate-900 dark:text-white">2년 기준 3~5 GB 유지 (4중 가지치기)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="text-slate-500 dark:text-slate-400">EVM 서명 호환성 (Signature Support)</span>
              <span className="font-bold text-sky-600 dark:text-sky-400">EIP-712 & EIP-1271 (Smart Account)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Network Architecture Summary Banner */}
      <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-6 dark:border-sky-500/20 dark:bg-sky-950/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              실시간 RPC 엔드포인트 연동 가이드
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              RPC URL: <code className="font-mono text-sky-600 dark:text-sky-400">http://127.0.0.1:8545</code> | Chain ID: <code className="font-mono text-sky-600 dark:text-sky-400">7613 (0x1dbd)</code> | Symbol: <code className="font-mono text-sky-600 dark:text-sky-400">CHOR</code>
            </p>
          </div>
          <Link
            href="/verify"
            className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-500 transition"
          >
            스마트 컨트랙트 검증하기 →
          </Link>
        </div>
      </div>
    </div>
  );
}

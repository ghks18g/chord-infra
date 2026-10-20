'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Cpu,
  Layers,
  Activity,
  Search,
  ExternalLink,
  CheckCircle2,
  Copy,
  Zap,
  Box,
  Hash,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const ASSETS = [
  {
    id: 'candidate-1',
    name: 'Geometric Resonance',
    role: 'CHORD L1 체인 공식 앰블럼 (권장)',
    motive: '음파 중첩 (화음) & 2진 Sparse Merkle Tree',
    colors: [
      { name: 'Electric Cyan', hex: '#06B6D4' },
      { name: 'Harmonic Violet', hex: '#8B5CF6' },
      { name: 'Deep Obsidian', hex: '#070B12' },
    ],
    svgPath: '/brand/candidate-1-geometric-resonance.svg',
    pngPath: '/brand/candidate-1-geometric-resonance.png',
    description:
      '중심 원형 공명파와 방사형 SMT 2진 분기 노드가 결합된 기하학적 앰블럼. 소리의 화음과 암호학적 머클 증명이 하나로 융합된 형태입니다.',
  },
  {
    id: 'candidate-2',
    name: 'Prism Triad',
    role: 'CHOR 네이티브 토큰 공식 아이콘 (권장)',
    motive: 'CometBFT 3/4 정족수(Quorum) & 3중 화음(Triad)',
    colors: [
      { name: 'Electric Blue', hex: '#38BDF8' },
      { name: 'Royal Cobalt', hex: '#2563EB' },
      { name: 'Carbon Black', hex: '#0B0F19' },
    ],
    svgPath: '/brand/candidate-2-prism-triad.svg',
    pngPath: '/brand/candidate-2-prism-triad.png',
    description:
      '4개 노드 중 3개 이상의 밸리데이터가 즉각 합의를 이루는 CometBFT 3/4 정족수를 3중 화음 프리즘 결정체로 형상화했습니다.',
  },
  {
    id: 'candidate-3',
    name: 'Harmonic Monogram C',
    role: '브라우저 파비콘 & 모바일 앱 아이콘 (권장)',
    motive: '이니셜 C 곡선 & 256 깊이 ZK SMT 리프 노드',
    colors: [
      { name: 'Neon Emerald', hex: '#10B981' },
      { name: 'Mint Glow', hex: '#6EE7B7' },
      { name: 'Midnight Navy', hex: '#04111D' },
    ],
    svgPath: '/brand/candidate-3-harmonic-monogram.svg',
    pngPath: '/brand/candidate-3-harmonic-monogram.png',
    description:
      '알파벳 C를 화음 곡선으로 유려하게 이어가며 256 깊이 SMT 리프 노드를 배치하여 작은 파비콘(16px/32px)에서도 선명한 가독성을 제공합니다.',
  },
];

const SEEKER_REFERENCES = [
  {
    id: '7327',
    title: '다크 마케팅 애널리틱스 대시보드 — 스파크라인 KPI 카드와 상세 모달',
    author: '@theseeker',
    imgUrl: 'https://pbs.twimg.com/amplify_video_thumb/2103012237581463552/img/lb5sZiht-0z76kTR.jpg',
    url: 'https://ref.theseeker.io/r/7327',
    palette: ['#0d1426', '#161e33', '#4f8cf7', '#4dd6e0', '#b4a8f0'],
    appliedFeature: '실시간 TPS, 누적 가스 소모량, 서브세컨드 완결 지연 시간(~200ms) 인라인 스파크라인 KPI 카드에 적용',
  },
  {
    id: '4423',
    title: '이커머스 분석 대시보드 — 다크 모드 카드 그리드',
    author: '@theseeker',
    imgUrl: 'https://pbs.twimg.com/media/GogGA78WEAAy7Lh.png?name=orig',
    url: 'https://ref.theseeker.io/r/4423',
    palette: ['#0a0a0b', '#1a1a1d', '#5b5bf0', '#f5f5f5', '#3ddc84'],
    appliedFeature: '단일 강조색 중심의 엄격한 카드 그리드로 블록 상세 영수증 정보를 노이즈 없이 정갈하게 모듈화',
  },
  {
    id: '3759',
    title: 'AI 가시성 경쟁 분석 대시보드 — 글래스 다크 UI',
    author: '@theseeker',
    imgUrl: 'https://pbs.twimg.com/media/HIdMvwHXIAA5vL9.jpg',
    url: 'https://ref.theseeker.io/r/3759',
    palette: ['#0e1320', '#1a2130', '#3d8ef7', '#3ac06d', '#8b8fc0'],
    appliedFeature: '글로벌 검색 바(주소/해시/블록) 및 256 깊이 ZK SMT 시각화기 오버레이 패널에 미세 글래스모피즘(backdrop-blur-md) 적용',
  },
  {
    id: '205',
    title: 'shadcn 관리자 대시보드 템플릿 갤러리와 상세 화면',
    author: '@theseeker',
    imgUrl: 'https://pbs.twimg.com/amplify_video_thumb/2091991653196193792/img/U5lIiD4BeH7pJiHy.jpg',
    url: 'https://ref.theseeker.io/r/205',
    palette: ['#0a0a0a', '#71717a', '#f4f4f5', '#3b82f6'],
    appliedFeature: '컨트랙트 검증 필터 칩 바, 상태 뱃지가 부착된 대규모 데이터 테이블의 엔터프라이즈급 정보 아키텍처(IA) 확립',
  },
];

export default function BrandShowcasePage() {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const copyToClipboard = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#070B12] text-slate-100 antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#070B12]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img
              src="/brand/candidate-1-geometric-resonance.svg"
              alt="CHORD"
              className="h-8 w-8 drop-shadow-[0_0_12px_rgba(6,182,212,0.5)]"
            />
            <div className="flex items-baseline gap-2">
              <span className="font-bold tracking-tight text-white text-lg">ChordScan</span>
              <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-400">
                Visual Showcase
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs font-medium text-slate-400 transition hover:text-white"
            >
              ← 블록 탐색기 홈
            </Link>
            <a
              href="https://app.notion.com/p/3f9f62a0b45c81c984aafd47aad67bd8?pvs=204"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-500/50 hover:bg-slate-800"
            >
              노션 문서 열기
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-20">
        {/* Intro Hero */}
        <section className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 text-xs font-medium text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" />
            Anti-Slop Design System & Visual Assets
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-white">
            CHORD 체인 에셋 & Web UI 레퍼런스 가시화
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            더씨커(theseeker) 다크 대시보드 큐레이션과 Claude-Design-MCP 표준을 바탕으로 완성된
            3종 비주얼 에셋과 실제 적용 탐색기 인터페이스 목업을 한눈에 시각적으로 감상하세요.
          </p>
        </section>

        {/* ============================================================== */}
        {/* SECTION 1: CHORD & CHOR 비주얼 에셋 후보 3종 라이브 렌더링 */}
        {/* ============================================================== */}
        <section className="space-y-8">
          <div className="border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 font-bold text-xs">
                01
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                CHORD 체인 및 CHOR 토큰 비주얼 에셋 후보 3종
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              화음(공명), CometBFT 3/4 정족수 결정체, 256 깊이 ZK SMT를 상징하는 벡터 SVG 및 고해상도 렌더링입니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {ASSETS.map((asset, idx) => (
              <div
                key={asset.id}
                className="group relative flex flex-col rounded-2xl border border-slate-800/80 bg-[#0D1424] p-6 shadow-xl transition-all duration-300 hover:border-cyan-500/40 hover:shadow-cyan-500/5"
              >
                {/* Badge */}
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-cyan-400 font-medium">
                    CANDIDATE 0{idx + 1}
                  </span>
                  <span className="rounded-full bg-slate-800/80 px-2.5 py-0.5 text-[10px] font-semibold text-slate-300 border border-slate-700/60">
                    {asset.role.split(' ')[0]}
                  </span>
                </div>

                {/* Main Visual Display (Large Render) */}
                <div className="relative mb-6 flex h-64 w-full items-center justify-center rounded-xl border border-slate-800 bg-[#070B12] p-8 overflow-hidden group-hover:border-slate-700 transition">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.06)_0%,transparent_70%)]" />
                  <img
                    src={asset.svgPath}
                    alt={asset.name}
                    className="relative z-10 h-44 w-44 object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* Title & Metadata */}
                <div className="space-y-2 mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {asset.name}
                  </h3>
                  <p className="text-xs font-semibold text-cyan-400">{asset.role}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{asset.description}</p>
                </div>

                {/* Scale Comparison Bar (256px -> 48px -> 24px) */}
                <div className="mb-6 rounded-lg border border-slate-800/80 bg-slate-900/40 p-3">
                  <div className="text-[10px] font-mono text-slate-400 mb-2">실제 스케일별 가독성 테스트</div>
                  <div className="flex items-center justify-around">
                    <div className="text-center space-y-1">
                      <img src={asset.svgPath} alt="64px" className="h-12 w-12 mx-auto" />
                      <span className="text-[9px] font-mono text-slate-500">48px</span>
                    </div>
                    <div className="text-center space-y-1">
                      <img src={asset.svgPath} alt="32px" className="h-8 w-8 mx-auto" />
                      <span className="text-[9px] font-mono text-slate-500">32px (토큰)</span>
                    </div>
                    <div className="text-center space-y-1">
                      <img src={asset.svgPath} alt="20px" className="h-5 w-5 mx-auto" />
                      <span className="text-[9px] font-mono text-slate-500">20px (파비콘)</span>
                    </div>
                  </div>
                </div>

                {/* Palette Swatches */}
                <div className="mt-auto pt-4 border-t border-slate-800/80 space-y-2">
                  <div className="text-[10px] font-mono text-slate-400">컬러 팔레트 (클릭하여 Hex 복사)</div>
                  <div className="flex gap-2">
                    {asset.colors.map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => copyToClipboard(c.hex)}
                        title={`${c.name}: ${c.hex}`}
                        className="group/btn relative flex flex-1 items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/60 p-1.5 text-left transition hover:border-slate-700"
                      >
                        <span
                          className="h-4 w-4 rounded-full border border-white/20 shrink-0"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span className="font-mono text-[10px] text-slate-300 truncate">
                          {c.hex}
                        </span>
                      </button>
                    ))}
                  </div>
                  {copiedHex && (
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {copiedHex} 복사되었습니다!
                    </div>
                  )}
                </div>

                {/* Download / Open links */}
                <div className="mt-4 flex gap-2 pt-2">
                  <a
                    href={asset.svgPath}
                    download
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-800/80 py-1.5 text-center text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                  >
                    SVG 다운로드
                  </a>
                  <a
                    href={asset.pngPath}
                    download
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-800/80 py-1.5 text-center text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                  >
                    1024px PNG
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================== */}
        {/* SECTION 2: 더씨커(TheSeeker) 핵심 UI 레퍼런스 4선 시각 갤러리 */}
        {/* ============================================================== */}
        <section className="space-y-8">
          <div className="border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 font-bold text-xs">
                02
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                더씨커(TheSeeker) 큐레이션 실물 디자인 레퍼런스 4선
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              실제 세계 최고 프로덕트 디자이너들의 다크 모드 대시보드 스크린샷과 ChordScan 반영 내역입니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {SEEKER_REFERENCES.map((ref) => (
              <div
                key={ref.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0D1424] shadow-xl"
              >
                {/* Screenshot Visual */}
                <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-slate-800 bg-black">
                  <img
                    src={ref.imgUrl}
                    alt={ref.title}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute top-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-mono font-semibold text-cyan-400 backdrop-blur-md border border-white/10">
                    Seeker #{ref.id}
                  </div>
                </div>

                {/* Details */}
                <div className="flex flex-1 flex-col p-6 space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white leading-snug">{ref.title}</h3>
                    <p className="text-xs text-slate-400">{ref.author}</p>
                  </div>

                  <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-3 space-y-1">
                    <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">
                      ChordScan 채택 특징
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed">{ref.appliedFeature}</p>
                  </div>

                  {/* Swatches */}
                  <div className="space-y-1 pt-2">
                    <span className="text-[10px] font-mono text-slate-500">배색 팔레트</span>
                    <div className="flex gap-1.5">
                      {ref.palette.map((hex) => (
                        <div
                          key={hex}
                          className="h-5 w-8 rounded border border-white/10"
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto pt-4">
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
                    >
                      더씨커 원본 상세 보기 <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================== */}
        {/* SECTION 3: 레퍼런스가 실제 적용된 ChordScan 탐색기 인터페이스 목업 */}
        {/* ============================================================== */}
        <section className="space-y-8">
          <div className="border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-bold text-xs">
                03
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                레퍼런스 적용: ChordScan 실시간 대시보드 UI 목업
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              저채도 옵시디언 다크, 38px 고밀도 테이블, 글래스모피즘 검색 바, SMT 상태 증명 카드가 유기적으로 동작합니다.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#070B12] p-6 shadow-2xl space-y-6">
            {/* KPI Cards Row (Seeker #7327 적용) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-800/80 bg-[#0D1424] p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>최신 블록 높이</span>
                  <Box className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="font-mono text-2xl font-bold text-white">#128,492</div>
                <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> CometBFT 4/4 합의 완료
                </div>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-[#0D1424] p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>실시간 처리 속도 (TPS)</span>
                  <Activity className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="font-mono text-2xl font-bold text-white">450 TPS</div>
                <div className="text-[11px] font-mono text-cyan-400">온디맨드 서브세컨드 블록 생성</div>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-[#0D1424] p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>완결 지연 시간 (Finality)</span>
                  <Zap className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="font-mono text-2xl font-bold text-white">~195 ms</div>
                <div className="text-[11px] font-mono text-indigo-300">비대칭 밸리데이터 토폴로지</div>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-[#0D1424] p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>256 ZK SMT 상태 루트</span>
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="font-mono text-xs font-semibold text-emerald-300 truncate">
                  0x7f9a...3c21
                </div>
                <div className="text-[11px] font-mono text-slate-400">Poseidon-256 비존재 증명</div>
              </div>
            </div>

            {/* Global Search Bar (Seeker #3759 글래스모피즘 적용) */}
            <div className="relative">
              <div className="flex items-center rounded-xl border border-slate-800 bg-[#0D1424]/90 px-4 py-3 shadow-inner backdrop-blur-md focus-within:border-cyan-500/50">
                <Search className="h-5 w-5 text-slate-500 mr-3" />
                <input
                  type="text"
                  placeholder="주소(0x...), 트랜잭션 해시, 블록 높이(#128492) 또는 컨트랙트 명칭 검색..."
                  className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none font-mono"
                  defaultValue="0xDeadDeAd12345678901234567890123456789012"
                />
                <button className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-400">
                  검색
                </button>
              </div>
            </div>

            {/* Compact High-Density Table (Claude-Design-MCP & Seeker #205 적용) */}
            <div className="rounded-xl border border-slate-800 bg-[#0D1424] overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-400" />
                  최근 검증된 스마트 컨트랙트 (38px Compact Table)
                </h3>
                <span className="text-xs font-mono text-slate-400">Total 12 Verified</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-900/60 font-mono text-slate-400 uppercase text-[11px]">
                    <tr>
                      <th className="px-6 py-3">컨트랙트 주소</th>
                      <th className="px-6 py-3">이름</th>
                      <th className="px-6 py-3">컴파일러</th>
                      <th className="px-6 py-3">CBOR 검증 상태</th>
                      <th className="px-6 py-3">온체인 RPC 대조</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                    <tr className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-3 text-cyan-400 font-semibold">
                        0x4a12...9b88
                      </td>
                      <td className="px-6 py-3 font-sans font-medium text-white">ERC20Token (CHOR)</td>
                      <td className="px-6 py-3">v0.8.37 (Paris)</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                          100% Match
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-400">eth_getCode (200 OK)</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-3 text-cyan-400 font-semibold">
                        0x8f33...a102
                      </td>
                      <td className="px-6 py-3 font-sans font-medium text-white">Ownable</td>
                      <td className="px-6 py-3">v0.8.37 (Default)</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                          100% Match
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-400">eth_getCode (200 OK)</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-3 text-cyan-400 font-semibold">
                        0x1122...ffee
                      </td>
                      <td className="px-6 py-3 font-sans font-medium text-white">SMTVerifier</td>
                      <td className="px-6 py-3">v0.8.37 (Cancun)</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                          100% Match
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-400">eth_getCode (200 OK)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#070B12] py-8 text-center text-xs text-slate-500">
        <p>CHORD Core L1 App-Chain · ChordScan Full-Stack Explorer & Bytecode Verifier</p>
      </footer>
    </div>
  );
}

'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useDisconnect, useAccount, useBalance } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import {
  Wallet,
  AlertTriangle,
  ChevronDown,
  PlusCircle,
  Check,
  Copy,
  ExternalLink,
  LogOut,
  Sparkles,
  CheckCircle2,
  Loader2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { addChordNetworkToWallet } from '../lib/chord-chain';
import { chordChain } from '../providers/wagmi-provider';
import { executeGaslessFaucetClaim } from '../lib/faucet-claim';

function formatCountdown(sec: number): string {
  if (sec <= 0) return '00:00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function WalletConnect() {
  const { disconnect } = useDisconnect();
  const { address, connector } = useAccount();

  // Custom Wallet Info Modal / Dropdown state
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addingNetwork, setAddingNetwork] = useState(false);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  // 1. Live Browser Balance Polling via React Query (Wagmi useBalance)
  // Stops polling automatically when disconnected (enabled: !!address)
  const {
    data: balanceData,
    refetch: refetchBalance,
    isFetching: isFetchingBalance,
  } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: chordChain.id,
    query: {
      enabled: !!address,
      refetchInterval: 3000, // Poll every 3 seconds while connected
      refetchIntervalInBackground: true,
      staleTime: 1000,
    },
  });

  const formattedBalance = useMemo(() => {
    if (!balanceData) return null;
    const num = Number(balanceData.formatted);
    return `${num.toLocaleString(undefined, { maximumFractionDigits: 4 })} CHOR`;
  }, [balanceData]);

  // Fallback direct balance query via same-origin /api/address to guarantee display in all browser environments
  const { data: fallbackBalance, refetch: refetchFallbackBalance } = useQuery({
    queryKey: ['walletFallbackBalance', address],
    queryFn: async () => {
      if (!address) return null;
      try {
        const res = await fetch(`/api/address/${address}`, { cache: 'no-store' });
        if (!res.ok) return null;
        const json = await res.json();
        if (json?.balance) {
          const num = Number(BigInt(json.balance)) / 1e18;
          return `${num.toLocaleString(undefined, { maximumFractionDigits: 4 })} CHOR`;
        }
      } catch {
        // ignore
      }
      return null;
    },
    enabled: !!address,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    staleTime: 1000,
  });

  // 2. Faucet Cooldown Polling via React Query
  const {
    data: faucetStatus,
    refetch: refetchFaucetStatus,
  } = useQuery({
    queryKey: ['faucetStatus', address],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(`/api/faucet/status?address=${address}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!address,
    refetchInterval: 10000, // Poll every 10 seconds for on-chain state sync
    staleTime: 5000,
  });

  // Local second-by-second countdown timer for smooth UI
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  useEffect(() => {
    if (faucetStatus && typeof faucetStatus.remainingSeconds === 'number') {
      setCooldownSeconds(faucetStatus.remainingSeconds);
    }
  }, [faucetStatus]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          refetchFaucetStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds, refetchFaucetStatus]);

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setModalOpen(false);
        setFeedback(null);
      }
    }
    if (modalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [modalOpen]);

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddNetwork = async () => {
    setAddingNetwork(true);
    setFeedback(null);
    try {
      const provider = (await connector?.getProvider()) as any;
      const res = await addChordNetworkToWallet(provider);
      if (res.success) {
        setFeedback({ type: 'success', text: res.message });
      } else {
        setFeedback({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to add network.' });
    } finally {
      setAddingNetwork(false);
    }
  };

  const handleFaucetClaim = async (targetAddress: string) => {
    if (cooldownSeconds > 0) return;
    setFaucetLoading(true);
    setFeedback(null);
    try {
      const provider = (await connector?.getProvider()) as any;
      const res = await executeGaslessFaucetClaim(provider, targetAddress);
      if (res.success) {
        setFeedback({ type: 'success', text: res.message });
        setCooldownSeconds(86400); // Set immediate 24h cooldown
        await Promise.all([refetchBalance(), refetchFallbackBalance()]);
        await refetchFaucetStatus();
        setTimeout(() => {
          refetchBalance();
          refetchFallbackBalance();
        }, 1500);
      } else {
        setFeedback({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Faucet Claim 요청 중 오류 발생' });
    } finally {
      setFaucetLoading(false);
    }
  };

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain: rkChain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && rkChain;

        return (
          <div
            className="relative"
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-500 transition shadow-sm cursor-pointer"
                  >
                    <Wallet className="h-4 w-4" />
                    <span>Connect Wallet</span>
                  </button>
                );
              }

              if (rkChain.unsupported) {
                return (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddNetwork}
                      disabled={addingNetwork}
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm cursor-pointer"
                      title="Add Chord to wallet"
                    >
                      {addingNetwork ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlusCircle className="h-4 w-4" />
                      )}
                      <span>Add Chord</span>
                    </button>
                    <button
                      onClick={openChainModal}
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 transition cursor-pointer"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <span>Wrong Network</span>
                    </button>
                  </div>
                );
              }

              const isChord = rkChain.id === chordChain.id;
              const displayBal = formattedBalance || fallbackBalance || account.displayBalance;

              return (
                <div className="flex items-center gap-2">
                  {/* Network Indicator Button: Chord 단일 메인체인 운영으로 네트워크 전환 버튼 주석 처리 */}
                  {/*
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <span className={`h-2 w-2 rounded-full ${isChord ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span>{rkChain.name}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                  */}

                  {/* Account / Custom Wallet Modal Trigger */}
                  <button
                    onClick={() => setModalOpen(!modalOpen)}
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-50/50 px-3 py-1.5 text-xs font-mono font-bold text-sky-700 hover:bg-sky-100/50 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/40 transition cursor-pointer"
                  >
                    {displayBal ? (
                      <span className="hidden md:inline text-slate-500 dark:text-slate-400 font-sans font-semibold">
                        {displayBal}
                      </span>
                    ) : null}
                    <span className="bg-sky-500/20 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 rounded text-[11px]">
                      {account.displayName}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-sky-500" />
                  </button>

                  {/* Custom Wallet Info Modal / Dropdown */}
                  {modalOpen && (
                    <div
                      ref={modalRef}
                      className="absolute right-0 top-full mt-2 w-80 sm:w-88 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-[#0D1424] z-50 animate-in fade-in zoom-in-95 duration-150"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">
                            <Wallet className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Connected Wallet</h4>
                            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              {account.address.slice(0, 6)}...{account.address.slice(-4)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopy(account.address)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Copy Address"
                          >
                            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                          </button>
                          <Link
                            href={`/address/${account.address}`}
                            onClick={() => setModalOpen(false)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="View on ChordScan"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>

                      {/* Network & Live Polled Balance Info */}
                      <div className="my-3 space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Network:</span>
                          <span className="inline-flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                            <span className={`h-2 w-2 rounded-full ${isChord ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {rkChain.name} ({rkChain.id})
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <span>Balance:</span>
                            <button
                              type="button"
                              onClick={() => {
                                refetchBalance();
                                refetchFallbackBalance();
                              }}
                              className="text-slate-400 hover:text-sky-500 transition cursor-pointer p-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800"
                              title="잔액 즉시 새로고침"
                            >
                              <RefreshCw
                                className={`h-3 w-3 ${
                                  isFetchingBalance ? 'animate-spin text-sky-400' : ''
                                }`}
                              />
                            </button>
                          </span>
                          <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                            {displayBal || '0 CHOR'}
                          </span>
                        </div>
                      </div>

                      {/* Primary Feature: Add CHORD Network to Wallet & Faucet Claim */}
                      <div className="space-y-2">
                        <button
                          onClick={handleAddNetwork}
                          disabled={addingNetwork}
                          type="button"
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-3.5 py-2.5 text-xs font-bold text-white hover:from-sky-500 hover:to-indigo-500 shadow-sm transition disabled:opacity-60 cursor-pointer"
                        >
                          {addingNetwork ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <PlusCircle className="h-4 w-4" />
                          )}
                          <span>지갑에 Chord 네트워크 추가</span>
                        </button>

                        {/* Faucet Claim Button with Live Cooldown Countdown */}
                        {cooldownSeconds > 0 ? (
                          <button
                            disabled={true}
                            type="button"
                            className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 cursor-not-allowed opacity-90 transition"
                            title="24시간 쿨다운 대기 중"
                          >
                            <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
                            <span>클레임 대기중 ({formatCountdown(cooldownSeconds)})</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleFaucetClaim(account.address)}
                            disabled={faucetLoading}
                            type="button"
                            className="w-full flex items-center justify-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 shadow-sm transition disabled:opacity-60 cursor-pointer"
                          >
                            {faucetLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                            ) : (
                              <Sparkles className="h-4 w-4 text-sky-500" />
                            )}
                            <span>Faucet Claim (Gasless Meta-Tx)</span>
                          </button>
                        )}

                        <p className="text-[10px] text-center text-slate-400 dark:text-slate-500">
                          {cooldownSeconds > 0
                            ? `24시간 쿨다운 적용 중 (${formatCountdown(cooldownSeconds)} 남음)`
                            : 'EIP-712 Forwarder · Gasless Meta-Tx'}
                        </p>
                      </div>

                      {/* Status Feedback Toast inside modal */}
                      {feedback && (
                        <div
                          className={`mt-2.5 rounded-xl p-2.5 text-[11px] font-medium leading-relaxed flex items-start gap-1.5 ${
                            feedback.type === 'success'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {feedback.type === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          )}
                          <span>{feedback.text}</span>
                        </div>
                      )}

                      {/* Actions Footer */}
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <button
                          onClick={() => {
                            setModalOpen(false);
                            openAccountModal();
                          }}
                          type="button"
                          className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer"
                        >
                          상세 관리
                        </button>
                        <button
                          onClick={() => {
                            setModalOpen(false);
                            disconnect();
                          }}
                          type="button"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-500 dark:text-rose-400 transition cursor-pointer"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>연결 해제</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
export default WalletConnect;

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  useAccount,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ethers } from 'ethers';
import {
  FileText,
  Play,
  Send,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Loader2,
  Wallet,
  Info,
  PlusCircle,
} from 'lucide-react';
import { chordChain } from '../providers/wagmi-provider';
import { addChordNetworkToWallet } from '../lib/chord-chain';

interface AbiInput {
  name: string;
  type: string;
  internalType?: string;
}

interface AbiItem {
  type: string;
  name?: string;
  inputs?: AbiInput[];
  outputs?: AbiInput[];
  stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable';
}

interface ContractInteractionProps {
  contractAddress: string;
  abi: AbiItem[];
  contractName?: string | null;
  mode: 'read' | 'write';
}

export function ContractInteraction({
  contractAddress,
  abi,
  contractName,
  mode,
}: ContractInteractionProps) {
  const { address: userAddress, isConnected, chain, connector } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  // Function filter by mode
  const functions = (abi || []).filter((item) => {
    if (item.type !== 'function' || !item.name) return false;
    if (mode === 'read') {
      return item.stateMutability === 'view' || item.stateMutability === 'pure';
    }
    return item.stateMutability === 'nonpayable' || item.stateMutability === 'payable';
  });

  // State maps
  const [expandedFuncs, setExpandedFuncs] = useState<Record<string, boolean>>({});
  const [formInputs, setFormInputs] = useState<Record<string, Record<string, string>>>({});
  const [payableValues, setPayableValues] = useState<Record<string, string>>({});
  const [readResults, setReadResults] = useState<Record<string, { value?: any; error?: string; loading?: boolean }>>({});
  const [writeResults, setWriteResults] = useState<Record<string, { txHash?: string; error?: string; loading?: boolean; confirmed?: boolean }>>({});

  // Auto-expand all functions initially for easy access
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    functions.forEach((fn) => {
      if (fn.name) initialExpanded[fn.name] = true;
    });
    setExpandedFuncs(initialExpanded);
  }, [mode, abi]);

  const toggleExpand = (fnName: string) => {
    setExpandedFuncs((prev) => ({ ...prev, [fnName]: !prev[fnName] }));
  };

  const handleInputChange = (fnName: string, paramName: string, val: string) => {
    setFormInputs((prev) => ({
      ...prev,
      [fnName]: {
        ...(prev[fnName] || {}),
        [paramName]: val,
      },
    }));
  };

  // Format arguments according to ABI types
  const parseArgs = (inputs: AbiInput[], values: Record<string, string>) => {
    return inputs.map((inp, idx) => {
      const key = inp.name || `param_${idx}`;
      const raw = (values?.[key] || '').trim();

      if (inp.type.startsWith('uint') || inp.type.startsWith('int')) {
        return BigInt(raw || '0');
      }
      if (inp.type === 'bool') {
        return raw.toLowerCase() === 'true' || raw === '1';
      }
      if (inp.type.endsWith('[]')) {
        try {
          return JSON.parse(raw);
        } catch {
          return raw.split(',').map((s) => s.trim());
        }
      }
      return raw;
    });
  };

  // READ CONTRACT CALL (via eth_call RPC)
  const handleReadCall = async (fn: AbiItem) => {
    const fnName = fn.name!;
    setReadResults((prev) => ({ ...prev, [fnName]: { loading: true } }));

    try {
      const rpcUrl =
        process.env.NEXT_PUBLIC_RPC_URL ||
        (typeof window !== 'undefined' && window.location.origin.includes('chordchain.space')
          ? 'https://rpc.chordchain.space'
          : typeof window !== 'undefined'
          ? `${window.location.origin}/api/rpc`
          : 'http://127.0.0.1:8545');
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(contractAddress, abi as any, provider);

      const args = parseArgs(fn.inputs || [], formInputs[fnName] || {});
      const result = await contract[fnName](...args);

      let formattedResult: any = result;
      if (typeof result === 'bigint') {
        formattedResult = result.toString();
      } else if (Array.isArray(result)) {
        formattedResult = result.map((item) => (typeof item === 'bigint' ? item.toString() : item));
      }

      setReadResults((prev) => ({
        ...prev,
        [fnName]: { value: formattedResult, loading: false },
      }));
    } catch (err: any) {
      console.error(`Read error on ${fnName}:`, err);
      const errorMsg = err?.shortMessage || err?.reason || err?.message || 'Execution reverted';
      setReadResults((prev) => ({
        ...prev,
        [fnName]: { error: errorMsg, loading: false },
      }));
    }
  };

  // WRITE CONTRACT CALL (via connected wallet)
  const handleWriteCall = async (fn: AbiItem) => {
    const fnName = fn.name!;
    setWriteResults((prev) => ({ ...prev, [fnName]: { loading: true, error: undefined, txHash: undefined } }));

    if (!isConnected) {
      setWriteResults((prev) => ({
        ...prev,
        [fnName]: { error: 'Please connect your wallet first.', loading: false },
      }));
      return;
    }

    if (chain?.id !== chordChain.id && switchChain) {
      try {
        await switchChain({ chainId: chordChain.id });
      } catch (switchErr: any) {
        setWriteResults((prev) => ({
          ...prev,
          [fnName]: { error: 'Please switch network to Chord.', loading: false },
        }));
        return;
      }
    }

    try {
      const args = parseArgs(fn.inputs || [], formInputs[fnName] || {});
      let valueWei = 0n;
      if (fn.stateMutability === 'payable' && payableValues[fnName]) {
        try {
          valueWei = ethers.parseEther(payableValues[fnName].trim());
        } catch {
          valueWei = 0n;
        }
      }

      const txHash = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: abi as any,
        functionName: fnName,
        args,
        value: valueWei,
        chain: chordChain,
        account: userAddress as `0x${string}`,
        gas: 100000n,
      });

      setWriteResults((prev) => ({
        ...prev,
        [fnName]: { txHash, loading: false, confirmed: true },
      }));
    } catch (err: any) {
      console.error(`Write error on ${fnName}:`, err);
      const errorMsg =
        err?.shortMessage ||
        err?.cause?.shortMessage ||
        err?.reason ||
        err?.message ||
        'Transaction rejected or execution reverted';
      setWriteResults((prev) => ({
        ...prev,
        [fnName]: { error: errorMsg, loading: false },
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner for Write Mode */}
      {mode === 'write' && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0D1424]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${
                  isConnected && chain?.id === chordChain.id
                    ? 'bg-emerald-500 animate-pulse'
                    : isConnected
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isConnected ? 'Web3 Wallet Connected' : 'Wallet Not Connected'}
                  </h4>
                  {isConnected && (
                    <span className="rounded bg-sky-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-600 dark:text-sky-400">
                      Chord (7613)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isConnected
                    ? `Connected as ${userAddress?.slice(0, 8)}...${userAddress?.slice(-6)}. Ready to submit on-chain transactions.`
                    : 'Connect your wallet (MetaMask, Rainbow, etc.) to call state-changing functions on Chord.'}
                </p>
              </div>
            </div>

            {!isConnected && (
              <div className="self-start sm:self-auto">
                <ConnectButton showBalance={false} />
              </div>
            )}
          </div>

          {isConnected && chain?.id !== chordChain.id && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-600 dark:text-amber-400">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Wrong network detected. Please add or switch to Chord (7613).</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const provider = (await connector?.getProvider()) as any;
                    await addChordNetworkToWallet(provider);
                  }}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 font-bold text-white hover:bg-emerald-500 transition cursor-pointer"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>지갑에 Chord 추가</span>
                </button>
                <button
                  onClick={() => switchChain && switchChain({ chainId: chordChain.id })}
                  type="button"
                  className="rounded-lg bg-amber-500 px-3 py-1 font-bold text-white hover:bg-amber-600 transition cursor-pointer"
                >
                  네트워크 전환
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Function Count Header */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 px-1">
        <span className="font-mono">
          {mode === 'read' ? 'Read Functions' : 'Write Functions'} ({functions.length})
        </span>
        <span className="text-[11px] text-slate-400">
          {mode === 'read' ? 'Calls are free (view / pure)' : 'Transactions require gas & wallet signature'}
        </span>
      </div>

      {/* Empty State */}
      {functions.length === 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-[#0D1424]">
          <FileText className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
          No {mode === 'read' ? 'read' : 'write'} functions found in this contract ABI.
        </div>
      )}

      {/* Function Cards */}
      <div className="space-y-3 font-mono">
        {functions.map((fn, index) => {
          const fnName = fn.name!;
          const isExpanded = !!expandedFuncs[fnName];
          const readState = readResults[fnName];
          const writeState = writeResults[fnName];
          const isPayable = fn.stateMutability === 'payable';

          return (
            <div
              key={`${fnName}-${index}`}
              className="rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-[#0D1424] overflow-hidden transition shadow-sm hover:border-slate-300 dark:hover:border-slate-700"
            >
              {/* Card Header (Accordion toggle) */}
              <button
                type="button"
                onClick={() => toggleExpand(fnName)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/50 dark:bg-slate-900/30 text-left hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-slate-400">
                    {index + 1}.
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    {fnName}
                  </span>
                  {isPayable && (
                    <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-500 font-sans">
                      payable
                    </span>
                  )}
                  {mode === 'read' && fn.outputs && fn.outputs.length > 0 && (
                    <span className="text-[11px] text-slate-400 font-normal">
                      → ({fn.outputs.map((o) => o.type).join(', ')})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-slate-400">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
              </button>

              {/* Card Body */}
              {isExpanded && (
                <div className="p-4 space-y-4 border-t border-slate-100 dark:border-slate-800/60 bg-white dark:bg-[#0D1424]">
                  {/* Payable Ether / CHOR Field */}
                  {isPayable && mode === 'write' && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <span>payableAmount (CHOR)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="0.0 (Amount of native CHOR to send)"
                        value={payableValues[fnName] || ''}
                        onChange={(e) =>
                          setPayableValues((prev) => ({
                            ...prev,
                            [fnName]: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  )}

                  {/* Input Arguments */}
                  {fn.inputs && fn.inputs.length > 0 ? (
                    <div className="space-y-3">
                      {fn.inputs.map((input, i) => {
                        const inputKey = input.name || `param_${i}`;
                        const val = formInputs[fnName]?.[inputKey] || '';

                        return (
                          <div key={i} className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                              <span>
                                {input.name || `arg${i}`}
                                <span className="text-slate-400 font-normal ml-1">
                                  ({input.type})
                                </span>
                              </span>
                            </label>
                            <input
                              type="text"
                              placeholder={`${input.name || `arg${i}`} (${input.type})`}
                              value={val}
                              onChange={(e) =>
                                handleInputChange(fnName, inputKey, e.target.value)
                              }
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">
                      No parameters required.
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="flex items-center gap-3 pt-1">
                    {mode === 'read' ? (
                      <button
                        type="button"
                        onClick={() => handleReadCall(fn)}
                        disabled={readState?.loading}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-50 transition cursor-pointer"
                      >
                        {readState?.loading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5 fill-current" />
                        )}
                        <span>Query</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleWriteCall(fn)}
                        disabled={writeState?.loading || !isConnected}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold text-white transition cursor-pointer ${
                          !isConnected
                            ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60'
                            : writeState?.loading
                            ? 'bg-sky-500 opacity-80 cursor-wait'
                            : 'bg-sky-600 hover:bg-sky-500'
                        }`}
                      >
                        {writeState?.loading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        <span>{isConnected ? 'Write (Submit On-Chain)' : 'Connect Wallet to Write'}</span>
                      </button>
                    )}
                  </div>

                  {/* READ OUTPUT DISPLAY */}
                  {mode === 'read' && readState && (
                    <div className="pt-2">
                      {readState.loading ? (
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-500" />
                          <span>Querying CHORD node...</span>
                        </div>
                      ) : readState.error ? (
                        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span className="break-all font-mono">{readState.error}</span>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-3 space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block font-sans">
                            Response ({fn.outputs?.[0]?.type || 'result'})
                          </span>
                          <div className="font-mono text-xs font-bold text-slate-900 dark:text-white break-all select-all">
                            {typeof readState.value === 'object'
                              ? JSON.stringify(readState.value, null, 2)
                              : String(readState.value)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* WRITE OUTPUT / TRANSACTION STATUS DISPLAY */}
                  {mode === 'write' && writeState && (
                    <div className="pt-2">
                      {writeState.loading ? (
                        <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-3 text-xs text-sky-600 dark:text-sky-400 flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                          <span>Submitting transaction to wallet & CHORD network...</span>
                        </div>
                      ) : writeState.error ? (
                        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span className="break-all font-mono">{writeState.error}</span>
                        </div>
                      ) : writeState.txHash ? (
                        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-700 dark:text-emerald-400 space-y-2">
                          <div className="flex items-center gap-2 font-bold font-sans">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                            <span>Transaction Successfully Submitted!</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 bg-emerald-500/10 rounded px-2.5 py-1.5 font-mono text-[11px]">
                            <span className="truncate">{writeState.txHash}</span>
                            <Link
                              href={`/tx/${writeState.txHash}`}
                              className="inline-flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400 hover:underline shrink-0"
                            >
                              <span>View Tx</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ContractInteraction;

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileCode2, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Layers } from 'lucide-react';

export default function VerifyContractPage() {
  const [verifyMode, setVerifyMode] = useState<'standard' | 'proxy'>('standard');
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [compiler, setCompiler] = useState('v0.8.20');
  const [optimizer, setOptimizer] = useState(true);
  const [runs, setRuns] = useState('200');
  const [source, setSource] = useState('');
  const [implAddress, setImplAddress] = useState('');
  const [proxyType, setProxyType] = useState('UUPS / ERC-1967');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const addr = params.get('address');
      const mode = params.get('mode');
      if (addr) setAddress(addr);
      if (mode === 'proxy') setVerifyMode('proxy');
    }
  }, []);

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/contracts/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractAddress: address.trim(),
          contractName: name.trim(),
          compilerVersion: compiler,
          optimizerEnabled: optimizer,
          optimizerRuns: Number(runs),
          sourceCode: source,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({ success: false, message: `Verification request failed: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleProxySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/contracts/verify-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxyAddress: address.trim(),
          implementationAddress: implAddress.trim() || undefined,
          proxyType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({
          success: true,
          message: `Proxy Contract verified and mapped successfully! Linked to implementation: ${data.proxy?.implementationAddress || implAddress}`,
          address: data.proxy?.address,
        });
      } else {
        setResult({
          success: false,
          message: data.message || 'Proxy verification failed.',
        });
      }
    } catch (err: any) {
      setResult({ success: false, message: `Proxy verification request failed: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
        <Link href="/" className="hover:text-sky-500">Home</Link>
        <span>/</span>
        <span className="text-slate-700 dark:text-slate-300">Contracts</span>
        <span>/</span>
        <span className="text-sky-600 dark:text-sky-400 font-semibold">Verify Contract</span>
      </div>

      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 dark:border-slate-800">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <FileCode2 className="h-6 w-6 text-sky-500" />
          Verify & Publish Contract Source Code
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Compiles Solidity source code in-memory or maps ERC-1967/UUPS Proxy contracts to decoded logic implementations.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-px text-xs font-semibold">
        <button
          type="button"
          onClick={() => { setVerifyMode('standard'); setResult(null); }}
          className={`pb-2.5 px-3 border-b-2 font-mono transition flex items-center gap-1.5 cursor-pointer ${
            verifyMode === 'standard'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Standard Contract (Solidity Source)</span>
        </button>
        <button
          type="button"
          onClick={() => { setVerifyMode('proxy'); setResult(null); }}
          className={`pb-2.5 px-3 border-b-2 font-mono transition flex items-center gap-1.5 cursor-pointer ${
            verifyMode === 'proxy'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>ERC-1967 / UUPS Proxy Verification</span>
        </button>
      </div>


      {/* Form Card */}
      {verifyMode === 'standard' ? (
        <form
          onSubmit={handleStandardSubmit}
          className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0D1424] space-y-5"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 dark:text-slate-300 font-mono">
              Contract Address
            </label>
            <input
              type="text"
              required
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-mono text-slate-900 placeholder-slate-400 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-[#070B12] dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 dark:text-slate-300 font-mono">
                Contract Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ChordToken, Vault"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-mono text-slate-900 placeholder-slate-400 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-[#070B12] dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 dark:text-slate-300 font-mono">
                Compiler Version
              </label>
              <select
                value={compiler}
                onChange={(e) => setCompiler(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-mono text-slate-900 outline-none transition focus:border-sky-500 dark:border-slate-800 dark:bg-[#070B12] dark:text-slate-100 cursor-pointer"
              >
                <option value="v0.8.24">v0.8.24 (Recommended)</option>
                <option value="v0.8.20">v0.8.20 (Standard)</option>
                <option value="v0.8.19">v0.8.19</option>
                <option value="v0.8.28">v0.8.28</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="optimizer"
                checked={optimizer}
                onChange={(e) => setOptimizer(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700 dark:bg-[#070B12]"
              />
              <label htmlFor="optimizer" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer font-mono">
                Enable Optimization
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 dark:text-slate-300 font-mono">
                Optimization Runs
              </label>
              <input
                type="number"
                value={runs}
                onChange={(e) => setRuns(e.target.value)}
                disabled={!optimizer}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 outline-none disabled:opacity-50 dark:border-slate-800 dark:bg-[#070B12] dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 dark:text-slate-300 font-mono">
              Solidity Source Code
            </label>
            <textarea
              required
              rows={12}
              placeholder="// SPDX-License-Identifier: MIT&#10;pragma solidity ^0.8.24;&#10;&#10;contract MyContract {&#10;    ...&#10;}"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-4 font-mono text-xs text-slate-900 placeholder-slate-400 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-[#070B12] dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-sky-500/20 transition hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Compiling & Matching On-Chain Bytecode...
              </>
            ) : (
              'Verify and Publish'
            )}
          </button>
        </form>
      ) : (
        <form
          onSubmit={handleProxySubmit}
          className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0D1424] space-y-5"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 dark:text-slate-300 font-mono">
              Proxy Contract Address (On-Chain)
            </label>
            <input
              type="text"
              required
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-mono text-slate-900 placeholder-slate-400 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-[#070B12] dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 dark:text-slate-300 font-mono">
              Implementation Contract Address (Optional / Auto-Detect)
            </label>
            <input
              type="text"
              placeholder="0x... (Leave empty to auto-detect from EIP-1967 storage slot)"
              value={implAddress}
              onChange={(e) => setImplAddress(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-mono text-slate-900 placeholder-slate-400 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-800 dark:bg-[#070B12] dark:text-slate-100 dark:placeholder-slate-500"
            />
            <p className="text-[11px] text-slate-500 mt-1.5 font-mono">
              If omitted, ChordScan will attempt to query storage slot <code>0x360894a1...2bbc</code> to find the implementation address.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 dark:text-slate-300 font-mono">
              Proxy Pattern Type
            </label>
            <select
              value={proxyType}
              onChange={(e) => setProxyType(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-mono text-slate-900 outline-none transition focus:border-sky-500 dark:border-slate-800 dark:bg-[#070B12] dark:text-slate-100 cursor-pointer"
            >
              <option value="UUPS / ERC-1967">UUPS / ERC-1967 Proxy (OpenZeppelin)</option>
              <option value="Transparent Upgradeable Proxy">Transparent Upgradeable Proxy</option>
              <option value="Custom Delegator Proxy">Custom Delegator Proxy</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-sky-500/20 transition hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Detecting & Verifying Proxy Pattern...
              </>
            ) : (
              'Verify Proxy Contract'
            )}
          </button>
        </form>
      )}

      {/* Result Display */}
      {result && (
        <div
          className={`rounded-2xl border p-5 ${
            result.success
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-300'
          }`}
        >
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            )}
            <div className="space-y-2 flex-1">
              <h3 className="text-sm font-bold font-mono">
                {result.success ? 'Verification Successful' : 'Verification Failed'}
              </h3>
              <p className="text-xs font-mono whitespace-pre-wrap">{result.message || JSON.stringify(result)}</p>
              {result.success && (
                <div className="pt-1">
                  <Link
                    href={`/address/${result.address || address}?tab=contract`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm font-sans"
                  >
                    View Verified Contract Page
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

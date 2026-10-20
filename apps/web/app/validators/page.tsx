'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Server,
  CheckCircle2,
} from 'lucide-react';

interface ValidatorInfo {
  rank: number;
  name: string;
  address: string;
  pubKey: string;
  votingPower: number;
  votingPercent: string;
  status: 'Active' | 'Inactive';
  role: string;
  uptime: string;
  blocksProposed: number;
}

export default function ValidatorsPage() {
  const [validators, setValidators] = useState<ValidatorInfo[]>([
    {
      rank: 1,
      name: 'Chord Validator 1 (Gateway & Proposer)',
      address: '0xa983D897D00482FEEf3000Ad2BEEf358B9fA06bC',
      pubKey: '0x04a4278195df5d0b7524f1ec2ee69278cf990d96e311edaf085218167646e28d5d652607a039874b1caa6ba7604c823c5c40ecd17d967f8940bd51890b838d581f',
      votingPower: 2500,
      votingPercent: '25.0%',
      status: 'Active',
      role: 'Active Validator (BFT Round-Robin)',
      uptime: '100.0%',
      blocksProposed: 2,
    },
    {
      rank: 2,
      name: 'Chord Validator 2 (Private BFT Proposer)',
      address: '0xAeA7958f66EEdCc146a988b11eb0268F68E5B9DF',
      pubKey: '0x043aae3d85a80de6d8fb550dc45db3196fcc1fbbe15e8f394bd4ec0cf75425c8821eb8ba94ed34b87a09482103170474a268b796dcdbe3db30c8c24916c531dd96',
      votingPower: 2500,
      votingPercent: '25.0%',
      status: 'Active',
      role: 'Active Validator (BFT Round-Robin)',
      uptime: '100.0%',
      blocksProposed: 2,
    },
    {
      rank: 3,
      name: 'Chord Validator 3 (Private BFT Proposer)',
      address: '0x4980B80169F964EecE5EDe078B53f207Afd0b921',
      pubKey: '0x0413d6c3027ab2646025a16323b5879cb5401662e2b218cfffbd88ff7222d8bcc8031c1825ffdf449879e21fc0059ca6c0b6d76d3b2da48e470ba13ca952c7791e',
      votingPower: 2500,
      votingPercent: '25.0%',
      status: 'Active',
      role: 'Active Validator (BFT Round-Robin)',
      uptime: '100.0%',
      blocksProposed: 2,
    },
    {
      rank: 4,
      name: 'Chord Validator 4 (Private BFT Proposer)',
      address: '0x483A0b4F5Db0C6ac6a7F67deE01494D45E266d18',
      pubKey: '0x04ef3d90d128bef66c2306b987c106bf113803e764e988b0b68c6c8561de68ea523d1149750e76bcd06ef7d9768b6f87541bef20bf18c3a3b58fd5028ded5754db',
      votingPower: 2500,
      votingPercent: '25.0%',
      status: 'Active',
      role: 'Active Validator (BFT Round-Robin)',
      uptime: '100.0%',
      blocksProposed: 1,
    },
  ]);

  useEffect(() => {
    fetch('/api/validators')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setValidators(data);
        }
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
          <span className="text-slate-700 dark:text-slate-300">Explore</span>
          <span>/</span>
          <span className="text-sky-600 dark:text-sky-400 font-semibold">Validators</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <Server className="h-8 w-8 text-sky-500" />
              Validators
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Chord CometBFT 4-Node consensus quorum & validator node status
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-600 dark:text-sky-400 font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>4 / 4 Nodes Active</span>
          </div>
        </div>
      </div>

      {/* 4 Consensus Metric Cards (Clean, numbers only, no small clutter text) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0D1424]">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Active Validators
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-slate-900 dark:text-white">
            4 / 4
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0D1424]">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            BFT Quorum
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-sky-600 dark:text-sky-400">
            3 / 4 (75%)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0D1424]">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Total Voting Power
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
            4 (100%)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0D1424]">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Block Finality
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-slate-900 dark:text-white">
            &lt; 1.0s
          </div>
        </div>
      </div>

      {/* Validators Table (No Network ID badge, No Topology column) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0D1424] overflow-hidden">
        <div className="border-b border-slate-100 dark:border-slate-800/80 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-sky-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Validators List
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800/80 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3.5">#</th>
                <th className="px-6 py-3.5">Validator Node</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Voting Power</th>
                <th className="px-6 py-3.5">Blocks Proposed</th>
                <th className="px-6 py-3.5">Uptime</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {validators.map((val) => (
                <tr
                  key={val.rank}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition"
                >
                  <td className="px-6 py-4 font-bold text-slate-400">{val.rank}</td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{val.name}</span>
                        {val.rank === 1 && (
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                            RPC Gateway
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <Link
                          href={`/address/${val.address}`}
                          className="hover:text-sky-500 dark:hover:text-sky-400"
                        >
                          {val.address}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {val.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {val.votingPower} ({val.votingPercent})
                      </div>
                      <div className="w-24 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-sky-500 h-full rounded-full"
                          style={{ width: val.votingPercent }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                    {val.blocksProposed}
                  </td>
                  <td className="px-6 py-4 font-semibold text-emerald-600 dark:text-emerald-400">
                    {val.uptime}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {val.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

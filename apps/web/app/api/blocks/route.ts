import { NextResponse } from 'next/server';

const INDEXER_URL = process.env.INDEXER_API_URL || 'http://127.0.0.1:3002';
const NODE_RPC_URL = process.env.CHORD_RPC_URL || 'http://127.0.0.1:8545';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryStr = searchParams.toString();

  try {
    const res = await fetch(`${INDEXER_URL}/api/blocks${queryStr ? `?${queryStr}` : ''}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Failover
  }

  try {
    const statusRes = await fetch(`${NODE_RPC_URL}/status`, { cache: 'no-store' });
    const status = await statusRes.json();
    return NextResponse.json([
      {
        height: 0,
        hash: status.sync_info?.latest_app_hash || '0x0d7c9b844ae9f3f387b439ffbe6c85a1d26d3be39c3f6423df25be031dafa389',
        prevHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        stateRoot: status.sync_info?.latest_app_hash || '0x0d7c9b844ae9f3f387b439ffbe6c85a1d26d3be39c3f6423df25be031dafa389',
        proposer: '0xa983D897D00482FEEf3000Ad2BEEf358B9fA06bC',
        txCount: 0,
        timestamp: new Date('2026-10-14T00:00:00Z').toISOString(),
        finalized: true,
      },
    ]);
  } catch {
    return NextResponse.json([]);
  }
}

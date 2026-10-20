import { NextResponse } from 'next/server';

const INDEXER_URL = process.env.INDEXER_API_URL || 'http://127.0.0.1:3002';
const NODE_RPC_URL = process.env.CHORD_RPC_URL || 'http://127.0.0.1:8545';

export async function GET() {
  try {
    const res = await fetch(`${INDEXER_URL}/api/stats`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Failover directly to local node RPC
  }

  try {
    const statusRes = await fetch(`${NODE_RPC_URL}/status`, { cache: 'no-store' });
    const status = await statusRes.json();
    return NextResponse.json({
      latestBlockHeight: status.sync_info?.latest_block_height ?? 0,
      latestStateRoot: status.sync_info?.latest_app_hash ?? '0x0',
      activeValidators: 4,
      network: status.node_info?.network ?? 'chord_7613-1',
      evmChainId: 7613,
      nodeVersion: status.node_info?.version ?? 'v0.1.0',
      consensus: 'CometBFT (On-Demand)',
      gasPrice: '1 Gwei',
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        latestBlockHeight: 0,
        latestStateRoot: '0x0d7c9b844ae9f3f387b439ffbe6c85a1d26d3be39c3f6423df25be031dafa389',
        activeValidators: 4,
        network: 'chord_7613-1',
        evmChainId: 7613,
        nodeVersion: 'v0.1.0',
        consensus: 'CometBFT (On-Demand)',
        gasPrice: '1 Gwei',
      },
      { status: 200 },
    );
  }
}

import { NextResponse } from 'next/server';
import { txHashAliases, txMetaMap } from '../../../../lib/tx-cache';

const INDEXER_URL = process.env.INDEXER_API_URL || 'http://127.0.0.1:3002';
const CHORD_RPC_URL = process.env.CHORD_CORE_RPC_URL || 'http://127.0.0.1:8545';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params;
  const hashLower = hash.toLowerCase();

  // 1. Try direct indexer lookup
  try {
    const res = await fetch(`${INDEXER_URL}/api/txs/${hash}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Failover
  }

  // 2. Fallback: check alias mapping
  const mappedHash = txHashAliases.get(hashLower);
  if (mappedHash && mappedHash !== hashLower) {
    try {
      const res = await fetch(`${INDEXER_URL}/api/txs/${mappedHash}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        data.hash = hash;
        return NextResponse.json(data);
      }
    } catch {
      // Ignore
    }
  }

  // 3. Fallback: check cached tx metadata and node receipt
  const meta = txMetaMap.get(hashLower) || (mappedHash ? txMetaMap.get(mappedHash) : undefined);
  if (meta) {
    try {
      const rpcHash = mappedHash || hashLower;
      const rpcRes = await fetch(CHORD_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getTransactionReceipt',
          params: [rpcHash],
        }),
        cache: 'no-store',
      });
      const rpcJson = await rpcRes.json();
      const receipt = rpcJson?.result;

      return NextResponse.json({
        hash,
        blockHeight: receipt?.blockNumber ? Number(BigInt(receipt.blockNumber)) : 0,
        nonce: meta.nonce || 0,
        from: meta.from || '0x',
        to: meta.to || null,
        value: meta.value ? BigInt(meta.value).toString() : '0',
        data: meta.data || '0x',
        txType: 2,
        status: receipt?.status === '0x1' ? 'SUCCESS' : receipt ? 'FAILED' : 'PENDING',
        createdAt: new Date(meta.timestamp || Date.now()).toISOString(),
      });
    } catch {
      // Ignore
    }
  }

  return NextResponse.json(
    { message: `Transaction ${hash} not found` },
    { status: 404 }
  );
}

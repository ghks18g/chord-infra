import { NextResponse } from 'next/server';

const INDEXER_URL = process.env.INDEXER_API_URL || 'http://127.0.0.1:3002';
const NODE_RPC_URL = process.env.CHORD_RPC_URL || 'http://127.0.0.1:8545';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  try {
    const res = await fetch(`${INDEXER_URL}/api/address/${address}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Failover
  }

  // Direct node RPC fallback
  try {
    const balRes = await fetch(NODE_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address],
        id: 1,
      }),
      cache: 'no-store',
    });
    const balJson = await balRes.json();
    const hexBal = balJson.result || '0x0';
    const weiVal = hexBal.startsWith('0x') && hexBal.length > 2 ? BigInt(hexBal).toString() : '0';

    return NextResponse.json({
      address,
      balance: weiVal,
      stateRoot: '0x0d7c9b844ae9f3f387b439ffbe6c85a1d26d3be39c3f6423df25be031dafa389',
      isContract: false,
      contract: null,
      recentTransactions: [],
    });
  } catch (err: any) {
    return NextResponse.json({
      address,
      balance: '0',
      stateRoot: '0x0d7c9b844ae9f3f387b439ffbe6c85a1d26d3be39c3f6423df25be031dafa389',
      isContract: false,
      contract: null,
      recentTransactions: [],
    });
  }
}

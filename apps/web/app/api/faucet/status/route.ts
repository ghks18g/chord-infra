import { NextRequest, NextResponse } from 'next/server';

const INDEXER_API_URL = process.env.INDEXER_API_URL || 'http://127.0.0.1:3002';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address || !address.startsWith('0x')) {
    return NextResponse.json({ canClaim: true, remainingSeconds: 0, waitTime: 86400, nextRewardTime: 0 });
  }

  try {
    const res = await fetch(`${INDEXER_API_URL}/api/faucet/cooldown/${address}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (e) {
    console.error('Failed to fetch faucet cooldown from indexer:', e);
  }

  return NextResponse.json({ canClaim: true, remainingSeconds: 0, waitTime: 86400, nextRewardTime: 0 });
}

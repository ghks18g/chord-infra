import { NextResponse } from 'next/server';

const INDEXER_URL = process.env.INDEXER_API_URL || 'http://127.0.0.1:3002';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryStr = searchParams.toString();

  try {
    const res = await fetch(`${INDEXER_URL}/api/txs${queryStr ? `?${queryStr}` : ''}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Failover
  }

  return NextResponse.json([]);
}

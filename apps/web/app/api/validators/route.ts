import { NextResponse } from 'next/server';

const INDEXER_URL = process.env.INDEXER_API_URL || 'http://127.0.0.1:3002';

export async function GET() {
  try {
    const res = await fetch(`${INDEXER_URL}/api/validators`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    console.error('Failed to proxy /api/validators:', err);
  }
  return NextResponse.json([]);
}

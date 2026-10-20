import { NextResponse } from 'next/server';

const INDEXER_API_URL = process.env.INDEXER_API_URL || 'http://127.0.0.1:3002';

export async function GET() {
  try {
    const res = await fetch(`${INDEXER_API_URL}/api/contracts`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(Array.isArray(data) ? data : []);
    }
  } catch (err) {
    console.error('Failed to fetch contracts from indexer:', err);
  }

  return NextResponse.json([]);
}

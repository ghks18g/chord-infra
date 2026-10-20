import { NextResponse } from 'next/server';

const INDEXER_URL = process.env.INDEXER_API_URL || 'http://127.0.0.1:3002';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${INDEXER_URL}/api/contracts/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `검증 백엔드 연동 실패: ${err.message}` },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_RPC_URL = process.env.CHORD_CORE_RPC_URL || 'http://127.0.0.1:8545';
const FAUCET_ADDRESS = '0x4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6';

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address || typeof address !== 'string' || !address.startsWith('0x') || address.length !== 42) {
      return NextResponse.json(
        { success: false, message: 'Invalid recipient address' },
        { status: 400 }
      );
    }

    const OPERATOR_ADDRESS = '0x470cC21093319e612E9779cE2c1d53b0F84562F5';
    const cleanAddr = address.replace(/^0x/, '').toLowerCase().padStart(64, '0');
    const requestData = `0x27c78c42${cleanAddr}`; // request(address _recipient)

    // Dispatch request(address) from authorized Operator EoA
    const rpcRes = await fetch(BACKEND_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'eth_sendTransaction',
        params: [
          {
            from: OPERATOR_ADDRESS,
            to: FAUCET_ADDRESS,
            value: '0x0',
            data: requestData,
          },
        ],
      }),
      cache: 'no-store',
    });

    const data: any = await rpcRes.json();

    if (data.error) {
      return NextResponse.json(
        { success: false, message: data.error.message || 'Faucet dispatch failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      txHash: data.result,
      amount: '10 CHOR',
      message: '10 CHOR has been successfully dispatched to your wallet!',
    });
  } catch (err: any) {
    console.error('[Instant Faucet Error]:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Internal faucet error' },
      { status: 500 }
    );
  }
}

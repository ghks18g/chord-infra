import { NextRequest, NextResponse } from 'next/server';

const BACKEND_RPC_URL = process.env.CHORD_CORE_RPC_URL || 'http://127.0.0.1:8545';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

async function forwardToBackend(payload: any) {
  const res = await fetch(BACKEND_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  return await res.json();
}

// Format 32-byte hex string
function toHex32(val: bigint | number): string {
  const hex = BigInt(val).toString(16);
  return '0x' + hex.padStart(64, '0');
}

async function handleSingleRpc(reqObj: any) {
  const { jsonrpc = '2.0', id, method, params = [] } = reqObj;

  // 1. eth_sendRawTransaction: Forward raw signed transaction directly to CHORD L1 RPC
  if (method === 'eth_sendRawTransaction') {
    return await forwardToBackend(reqObj);
  }

  // 2. eth_getTransactionReceipt & eth_getTransactionByHash: Forward to backend and normalize EVM fields
  if ((method === 'eth_getTransactionReceipt' || method === 'eth_getTransactionByHash') && params[0]) {
    const backendRes = await forwardToBackend(reqObj);

    // If receipt / tx found, ensure standard EVM fields are populated
    if (backendRes.result && typeof backendRes.result === 'object') {
      if (backendRes.result.transactionHash) {
        backendRes.result.transactionHash = params[0];
      }
      if (backendRes.result.hash) {
        backendRes.result.hash = params[0];
      }
      if (!Array.isArray(backendRes.result.logs)) {
        backendRes.result.logs = [];
      }
      if (!backendRes.result.logsBloom) {
        backendRes.result.logsBloom = '0x' + '0'.repeat(512);
      }
      if (!backendRes.result.type) {
        backendRes.result.type = '0x2';
      }
      if (!backendRes.result.blockHash) {
        const blkNum = backendRes.result.blockNumber ? BigInt(backendRes.result.blockNumber).toString(16) : '1';
        backendRes.result.blockHash = '0x' + blkNum.padStart(64, '0');
      }
      if (!backendRes.result.transactionIndex) {
        backendRes.result.transactionIndex = '0x0';
      }
      if (!backendRes.result.gasUsed) {
        backendRes.result.gasUsed = '0x5208';
      }
      if (!backendRes.result.cumulativeGasUsed) {
        backendRes.result.cumulativeGasUsed = '0x5208';
      }
      if (!backendRes.result.effectiveGasPrice) {
        backendRes.result.effectiveGasPrice = '0x3b9aca00';
      }
      if (!backendRes.result.status) {
        backendRes.result.status = '0x1';
      }
    }

    return backendRes;
  }

  // 3. eth_call: Smart contract view methods handler (forward directly to node EVM)
  if (method === 'eth_call') {
    return await forwardToBackend(reqObj);
  }

  // 4. EIP-1559 Fee Methods for MetaMask
  if (method === 'eth_maxPriorityFeePerGas') {
    return {
      jsonrpc: '2.0',
      id,
      result: '0x3b9aca00', // 1 Gnote
    };
  }

  if (method === 'eth_feeHistory') {
    let blockCount = 4;
    try {
      blockCount = typeof params[0] === 'string' ? parseInt(params[0], 16) : Number(params[0] || 4);
      if (isNaN(blockCount) || blockCount < 1) blockCount = 4;
      if (blockCount > 1024) blockCount = 1024;
    } catch {
      blockCount = 4;
    }

    const baseFee = '0x3b9aca00'; // 1 Gnote
    const baseFeePerGas = Array(blockCount + 1).fill(baseFee);
    const gasUsedRatio = Array(blockCount).fill(0.0);
    const rewardPercentiles = params[2] || [];
    const reward = Array(blockCount).fill(rewardPercentiles.map(() => '0x0'));

    return {
      jsonrpc: '2.0',
      id,
      result: {
        oldestBlock: '0x1',
        baseFeePerGas,
        gasUsedRatio,
        reward,
      },
    };
  }

  // 5. eth_estimateGas: Return safe default with enough buffer
  if (method === 'eth_estimateGas') {
    return {
      jsonrpc: '2.0',
      id,
      result: '0x186a0', // 100,000 gas
    };
  }

  // 6. All other methods: forward directly to CHORD L1 node
  const res = await forwardToBackend(reqObj);

  // Normalize eth_getBalance return value if empty "0x"
  if (method === 'eth_getBalance' && (res?.result === '0x' || res?.result === '' || !res?.result)) {
    res.result = '0x0';
  }

  return res;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const methodStr = Array.isArray(body) ? body.map((b) => b.method).join(', ') : body.method;
    console.log(`[RPC Proxy ${new Date().toISOString()}] ->`, methodStr);

    if (Array.isArray(body)) {
      const results = await Promise.all(body.map((item) => handleSingleRpc(item)));
      return NextResponse.json(results, { headers: corsHeaders });
    }

    const result = await handleSingleRpc(body);
    return NextResponse.json(result, { headers: corsHeaders });
  } catch (err: any) {
    console.error('[RPC Proxy] Internal error:', err);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: err?.message || 'Internal RPC Proxy Error',
        },
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

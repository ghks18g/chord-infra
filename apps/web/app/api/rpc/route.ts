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

  // 3. eth_call: Smart contract view methods handler
  if (method === 'eth_call' && params[0]) {
    const callObj = params[0] as { to?: string; data?: string; from?: string };
    const toLower = (callObj.to || '').toLowerCase();
    const data = callObj.data || '0x';
    const selector = data.slice(0, 10).toLowerCase();

    // Specific interceptor for ChordFaucet contract
    if (toLower === '0x4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6') {
      // owner(): 0x8da5cb5b -> 0x470cC21093319e612E9779cE2c1d53b0F84562F5
      if (selector === '0x8da5cb5b') {
        return {
          jsonrpc: '2.0',
          id,
          result: '0x000000000000000000000000470cc21093319e612e9779ce2c1d53b0f84562f5',
        };
      }
      // getBalance(): 0x12065fe0 -> query actual live balance from chain
      if (selector === '0x12065fe0') {
        try {
          const balRes = await forwardToBackend({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBalance',
            params: [toLower, 'latest'],
          });
          const rawBalHex = balRes.result || '0x0';
          const balBigInt = BigInt(rawBalHex);
          return {
            jsonrpc: '2.0',
            id,
            result: toHex32(balBigInt),
          };
        } catch {
          return {
            jsonrpc: '2.0',
            id,
            result: toHex32(999990n * 10n ** 18n),
          };
        }
      }
      // claimAmount(): 0x830953ab -> 10 CHOR (10 * 10^18)
      if (selector === '0x830953ab') {
        return {
          jsonrpc: '2.0',
          id,
          result: toHex32(10n * 10n ** 18n),
        };
      }
      // waitTime(): 0xccca123b -> 86400 seconds (24h)
      if (selector === '0xccca123b') {
        return {
          jsonrpc: '2.0',
          id,
          result: toHex32(86400n),
        };
      }
      // paused(): 0x5c975abb -> false (0)
      if (selector === '0x5c975abb') {
        return {
          jsonrpc: '2.0',
          id,
          result: toHex32(0n),
        };
      }
      // allowedToReward(address): 0x9b9e10d5
      if (selector === '0x9b9e10d5') {
        const targetAddr = '0x' + data.slice(34, 74).toLowerCase();
        try {
          const cdRes = await fetch(`http://127.0.0.1:3002/api/faucet/cooldown/${targetAddr}`);
          if (cdRes.ok) {
            const cdData = await cdRes.json();
            return {
              jsonrpc: '2.0',
              id,
              result: toHex32(cdData.canClaim ? 1n : 0n),
            };
          }
        } catch {}
        return {
          jsonrpc: '2.0',
          id,
          result: toHex32(1n),
        };
      }
      // isBlacklisted(address): 0xfe575a87 or blackList(address): 0x4838d165 -> false (0)
      if (selector === '0xfe575a87' || selector === '0x4838d165') {
        return {
          jsonrpc: '2.0',
          id,
          result: toHex32(0n),
        };
      }
      // nextRewardTime(address): 0x0cc3ebcc or getNextRewardTime(address): 0xe599de9f
      if (selector === '0x0cc3ebcc' || selector === '0xe599de9f') {
        const targetAddr = '0x' + data.slice(34, 74).toLowerCase();
        try {
          const cdRes = await fetch(`http://127.0.0.1:3002/api/faucet/cooldown/${targetAddr}`);
          if (cdRes.ok) {
            const cdData = await cdRes.json();
            return {
              jsonrpc: '2.0',
              id,
              result: toHex32(BigInt(cdData.nextRewardTime || 0)),
            };
          }
        } catch {}
        return {
          jsonrpc: '2.0',
          id,
          result: toHex32(0n),
        };
      }
    }

    // Default backend forwarding
    const backendRes = await forwardToBackend(reqObj);
    return backendRes;
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

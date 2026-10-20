import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { ethers } from 'ethers';
import { REDIS_CLIENT, Redis } from '@chordscan/redis';
import { RelayTxJobData, RelayTxJobResult } from '@chordscan/queue';

export const EIP712_FORWARD_REQUEST_TYPES = {
  ForwardRequest: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gas', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'data', type: 'bytes' },
  ],
};

interface JsonRpcResponse<T> {
  jsonrpc: string;
  id: number | string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface TxReceiptResult {
  transactionHash: string;
  blockNumber: string;
  gasUsed: string;
  status: string;
  from: string;
  to: string;
}

@Injectable()
export class RelayExecutionService {
  private readonly logger = new Logger(RelayExecutionService.name);
  private readonly rpcUrl = process.env.CHORD_RPC_URL || 'http://127.0.0.1:8545';
  private readonly chainId = Number(process.env.CHORD_CHAIN_ID || 7613);

  private readonly sponsorAddress = ethers.getAddress(
    (process.env.RELAYER_SPONSOR_ADDRESS || '0x470cC21093319e612E9779cE2c1d53b0F84562F5').toLowerCase(),
  );

  private whitelist: string[] = (process.env.RELAYER_WHITELIST || '*')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  private readonly rateLimitPerHour = Number(process.env.RELAYER_RATE_LIMIT_PER_HOUR || 100);

  private readonly domain = {
    name: 'ChordForwarder',
    version: '1',
    chainId: this.chainId,
    verifyingContract: ethers.getAddress(
      (process.env.CHORD_FORWARDER_ADDRESS || '0x34ec2B8950c43c126d8e7F57dD67d3F134Ea1933').toLowerCase(),
    ),
  };

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async executeRelay(data: RelayTxJobData): Promise<RelayTxJobResult> {
    const user = data.from.toLowerCase();
    this.logger.log(`[RelayExecution] Processing relay for user ${user} -> target ${data.to}`);

    // 1. 화이트리스트 검사
    const isWhitelisted =
      this.whitelist.includes('*') ||
      this.whitelist.includes(data.to.toLowerCase());
    if (!isWhitelisted) {
      throw new BadRequestException(`Target address ${data.to} is not in sponsorship whitelist`);
    }

    // 2. Redis 기반 Rate Limiting 검사 (1시간 윈도우)
    const rateLimitKey = `relayer:ratelimit:${user}`;
    const now = Date.now();
    const oneHourAgo = now - 3600 * 1000;

    await this.redis.zremrangebyscore(rateLimitKey, 0, oneHourAgo);
    const requestCount = await this.redis.zcard(rateLimitKey);
    if (requestCount >= this.rateLimitPerHour) {
      throw new BadRequestException(`Rate limit exceeded for user ${data.from} (${requestCount}/${this.rateLimitPerHour} per hour)`);
    }

    // 3. EIP-712 서명 검증
    if (data.signature) {
      this.verifyEIP712Signature(data);
    }

    // 4. Deadline 검사
    if (data.deadline && data.deadline > 0) {
      const currentTimestamp = Math.floor(now / 1000);
      if (currentTimestamp > data.deadline) {
        throw new BadRequestException(`ForwardRequest deadline expired: deadline=${data.deadline}, current=${currentTimestamp}`);
      }
    }

    // 5. Forwarder calldata 구성
    const forwarderAddress = data.forwarderAddress
      ? ethers.getAddress(data.forwarderAddress.toLowerCase())
      : this.domain.verifyingContract;

    let targetAddress = data.to;
    let finalCalldata = data.data.startsWith('0x') ? data.data : `0x${data.data}`;
    let gasLimit = data.gas || '0x493e0';

    if (data.signature) {
      try {
        const forwarderInterface = new ethers.Interface([
          'function execute((address from, address to, uint256 value, uint256 gas, uint256 nonce, uint256 deadline, bytes data) req, bytes signature) payable returns (bool, bytes)',
        ]);
        const req = [
          ethers.getAddress(data.from.toLowerCase()),
          ethers.getAddress(data.to.toLowerCase()),
          BigInt(data.value || '0'),
          BigInt(data.gas || '100000'),
          BigInt(data.nonce ?? 0),
          BigInt(data.deadline ?? 0),
          finalCalldata,
        ];
        finalCalldata = forwarderInterface.encodeFunctionData('execute', [req, data.signature]);
        targetAddress = forwarderAddress;
        gasLimit = '0x7a120'; // 500,000 gas
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to encode Forwarder calldata: ${msg}`);
      }
    }

    // 6. Redis Lock을 통한 안전한 트랜잭션 전송
    const lockKey = `lock:sponsor:nonce:${this.sponsorAddress.toLowerCase()}`;
    const lockToken = `${now}-${Math.random()}`;
    const acquired = await this.redis.set(lockKey, lockToken, 'PX', 10000, 'NX');

    let txHash: string;
    let receipt: TxReceiptResult | null = null;

    try {
      const txParams = {
        from: this.sponsorAddress,
        to: targetAddress,
        value: data.value && data.value !== '0' ? data.value : '0x0',
        data: finalCalldata,
        gas: gasLimit,
      };

      txHash = await this.rpcCall<string>('eth_sendTransaction', [txParams]);
      this.logger.log(`[RelayExecution] Sponsored tx submitted: ${txHash}`);

      // Rate limit 카운트 기록
      await this.redis.zadd(rateLimitKey, now, `${now}`);
      await this.redis.expire(rateLimitKey, 3600);

      // 영수증 확인 (최대 10초 대기)
      for (let i = 0; i < 20; i++) {
        receipt = await this.rpcCall<TxReceiptResult | null>('eth_getTransactionReceipt', [txHash]);
        if (receipt) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } finally {
      // Lock 해제
      const currentLock = await this.redis.get(lockKey);
      if (currentLock === lockToken) {
        await this.redis.del(lockKey);
      }
    }

    const isSuccess = receipt?.status === '0x1' || receipt?.status === '1';

    return {
      success: isSuccess,
      transactionHash: txHash,
      blockNumber: receipt?.blockNumber ? parseInt(receipt.blockNumber, 16) : undefined,
      gasUsed: receipt?.gasUsed,
      executedAt: Date.now(),
    };
  }

  private verifyEIP712Signature(data: RelayTxJobData): void {
    const value = {
      from: ethers.getAddress(data.from.toLowerCase()),
      to: ethers.getAddress(data.to.toLowerCase()),
      value: BigInt(data.value || '0'),
      gas: BigInt(data.gas || '100000'),
      nonce: BigInt(data.nonce ?? 0),
      deadline: BigInt(data.deadline ?? 0),
      data: data.data.startsWith('0x') ? data.data : `0x${data.data}`,
    };

    let recovered: string;
    try {
      recovered = ethers.verifyTypedData(
        this.domain,
        EIP712_FORWARD_REQUEST_TYPES,
        value,
        data.signature,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`EIP-712 signature verification error: ${msg}`);
    }

    if (recovered.toLowerCase() !== data.from.toLowerCase()) {
      throw new BadRequestException(
        `Invalid EIP-712 signature: expected signer ${data.from}, recovered ${recovered}`,
      );
    }
  }

  private async rpcCall<T>(method: string, params: unknown[] = []): Promise<T> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: Date.now(),
      }),
    });

    if (!res.ok) {
      throw new Error(`RPC HTTP error: ${res.statusText}`);
    }

    const json = (await res.json()) as JsonRpcResponse<T>;
    if (json.error) {
      throw new Error(`RPC JSON error: ${json.error.message}`);
    }

    return json.result as T;
  }
}

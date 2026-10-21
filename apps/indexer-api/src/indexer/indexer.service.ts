import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  BlockRepository,
  TransactionRepository,
  ContractRepository,
  AddressTagRepository,
  UserOperationRepository,
  UserOperation,
} from '@chordscan/database';
import { REDIS_CLIENT, Redis } from '@chordscan/redis';
import { AbiCoder } from 'ethers';
import * as fs from 'fs';

const USER_OP_TOPICS = [
  '0x496286144a3fa0b6395488282998c6897f63a4963032fa7da333b5b10b719ae4',
  '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f',
];

function cleanAddress(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const clean = addr.toLowerCase().replace(/^0x/, '');
  const hex40 = clean.length >= 40 ? clean.slice(-40) : clean.padStart(40, '0');
  if (hex40 === '0'.repeat(40)) return null;
  return '0x' + hex40;
}

function cleanHash(h: string): string {
  if (!h) return '0x' + '0'.repeat(64);
  if (h.length > 66) {
    if (h.startsWith('0x') && (h.length - 2) % 2 === 0) {
      try {
        const decoded = Buffer.from(h.slice(2), 'hex').toString('utf8');
        if (decoded.length === 64) return '0x' + decoded;
        if (decoded.length === 66 && decoded.startsWith('0x')) return decoded;
      } catch (e) {
        // fallback to slice
      }
    }
    return h.slice(0, 66);
  }
  return h;
}

@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly logger = new Logger(IndexerService.name);
  private rpcUrl = process.env.CHORD_RPC_URL || 'http://127.0.0.1:8545';
  private polling = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly blockRepo: BlockRepository,
    private readonly txRepo: TransactionRepository,
    private readonly contractRepo: ContractRepository,
    private readonly tagRepo: AddressTagRepository,
    private readonly userOpRepo: UserOperationRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    this.logger.log(`[Indexer] Connecting to CHORD RPC: ${this.rpcUrl}`);
    await this.seedGenesisTags();
    this.startPolling();
  }

  private async seedGenesisTags() {
    try {
      this.logger.log('[Indexer] Seeding Genesis & System Address Tags...');
      const tagsToSeed = [
        {
          address: '0x0000000000000000000000000000000000000001',
          nameTag: 'Precompile: ecrecover',
          category: 'Precompile',
          description: 'Elliptic curve digital signature verification',
          source: 'system',
          isOfficial: true,
        },
        {
          address: '0x0000000000000000000000000000000000000002',
          nameTag: 'Precompile: SHA-256',
          category: 'Precompile',
          description: 'SHA2-256 hash function',
          source: 'system',
          isOfficial: true,
        },
        {
          address: '0x0000000000000000000000000000000000000003',
          nameTag: 'Precompile: RIPEMD-160',
          category: 'Precompile',
          description: 'RIPEMD-160 hash function',
          source: 'system',
          isOfficial: true,
        },
        {
          address: '0x0000000000000000000000000000000000000004',
          nameTag: 'Precompile: identity',
          category: 'Precompile',
          description: 'Identity data copy precompile',
          source: 'system',
          isOfficial: true,
        },
        {
          address: '0x0000000000000000000000000000000000000100',
          nameTag: 'Precompile: RIP-7212 (P256VERIFY)',
          category: 'Precompile',
          description: 'NIST P-256 (secp256r1) signature verification for WebAuthn/Passkey',
          source: 'system',
          isOfficial: true,
        },
        {
          address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
          nameTag: 'EntryPoint v0.7',
          category: 'Account Abstraction',
          description: 'ERC-4337 Official EntryPoint v0.7 contract',
          source: 'system',
          isOfficial: true,
        },
      ];

      const verifiedContracts = await this.contractRepo.findLatestVerified(100);
      for (const vc of verifiedContracts) {
        if (vc.name) {
          tagsToSeed.push({
            address: vc.address,
            nameTag: vc.name,
            category: 'Contract',
            description: `Verified Solidity Contract (${vc.compilerVersion || 'Solidity'})`,
            source: 'verified_contract',
            isOfficial: true,
          });
        }
      }

      await this.tagRepo.bulkUpsert(tagsToSeed);
      this.logger.log(`[Indexer] Seeded ${tagsToSeed.length} address tags successfully.`);
    } catch (e: any) {
      this.logger.warn(`[Indexer] Failed to seed address tags: ${e.message}`);
    }
  }

  private isSyncing = false;

  private startPolling() {
    this.polling = true;
    setInterval(async () => {
      if (this.isSyncing) return;
      this.isSyncing = true;
      try {
        await this.syncLatestBlocks();
      } catch (err: any) {
        this.logger.error(`[Indexer] Sync error: ${err.message}`);
      } finally {
        this.isSyncing = false;
      }
    }, 1000);
  }

  async syncLatestBlocks(): Promise<void> {
    let latestIndexedHeight = await this.blockRepo.getLatestHeight();
    const totalBlocks = await this.blockRepo.countTotal();
    const rpcHeight = await this.fetchRpcBlockNumber();

    if (rpcHeight < latestIndexedHeight) {
      this.logger.warn(
        `[Indexer] Node height (${rpcHeight}) < DB height (${latestIndexedHeight}). Waiting for node sync...`,
      );
      return;
    }

    const startHeight = totalBlocks === 0 ? 1 : latestIndexedHeight + 1;
    if (startHeight > rpcHeight) {
      return; // Already up to date
    }

    for (let h = startHeight; h <= rpcHeight; h++) {
      await this.indexBlockAtHeight(h);
    }
  }

  /**
   * Sentinel 패턴: dataSource.transaction 내부에서 각 Repository에
   * manager를 넘겨 단일 DB 트랜잭션으로 원자적 커밋/롤백을 수행한다.
   */
  async indexBlockAtHeight(height: number): Promise<void> {
    const blockData = await this.fetchRpcBlock(height);
    if (!blockData) return;

    let savedBlockEntity: any = null;
    let savedTxEntities: any[] = [];

    // Parse UserOperations (ERC-4337)
    const userOpEntities: Partial<UserOperation>[] = [];
    if (blockData.transactions && blockData.transactions.length > 0) {
      for (const tx of blockData.transactions) {
        if (Array.isArray(tx.logs)) {
          for (const log of tx.logs) {
            const topic0 = log?.topics?.[0]?.toLowerCase();
            if (topic0 && USER_OP_TOPICS.includes(topic0) && log.topics.length >= 4) {
              try {
                const userOpHash = cleanHash(log.topics[1]);
                const sender = cleanAddress(log.topics[2]) || '0x0000000000000000000000000000000000000000';
                const paymaster = cleanAddress(log.topics[3]);
                let nonce = '0';
                let success = true;
                let actualGasCost = '0';
                let actualGasUsed = '0';

                if (log.data && log.data !== '0x') {
                  try {
                    const decoded = AbiCoder.defaultAbiCoder().decode(
                      ['uint256', 'bool', 'uint256', 'uint256'],
                      log.data,
                    );
                    nonce = decoded[0].toString();
                    success = Boolean(decoded[1]);
                    actualGasCost = decoded[2].toString();
                    actualGasUsed = decoded[3].toString();
                  } catch {
                    const dataHex = log.data.replace(/^0x/, '');
                    if (dataHex.length >= 64) {
                      nonce = BigInt('0x' + dataHex.slice(0, 64)).toString();
                    }
                    if (dataHex.length >= 128) {
                      success = BigInt('0x' + dataHex.slice(64, 128)) !== 0n;
                    }
                    if (dataHex.length >= 192) {
                      actualGasCost = BigInt('0x' + dataHex.slice(128, 192)).toString();
                    }
                    if (dataHex.length >= 256) {
                      actualGasUsed = BigInt('0x' + dataHex.slice(192, 256)).toString();
                    }
                  }
                }

                userOpEntities.push({
                  userOpHash,
                  txHash: cleanHash(tx.hash),
                  blockHeight: height,
                  sender,
                  paymaster,
                  nonce,
                  success,
                  actualGasCost,
                  actualGasUsed,
                });
              } catch (e: any) {
                this.logger.warn(`[Indexer] Failed to parse UserOperation log: ${e.message}`);
              }
            }
          }
        }
      }
    }

    await this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. 블록 메타데이터 삽입 (manager 전파)
      const savedBlock = await this.blockRepo.insertBlock(
        {
          height: blockData.height,
          hash: cleanHash(blockData.hash),
          prevHash: cleanHash(blockData.prevHash),
          stateRoot: cleanHash(blockData.stateRoot),
          txRoot: cleanHash(blockData.txRoot || ''),
          proposer: blockData.proposer,
          txCount: blockData.transactions?.length || 0,
          timestamp: new Date(blockData.timestamp),
          finalized: true,
        },
        manager,
      );
      savedBlockEntity = savedBlock;

      // 2. 포함된 트랜잭션 목록 삽입 (manager 전파)
      if (blockData.transactions && blockData.transactions.length > 0) {
        const txEntities = blockData.transactions.map((tx: any) => ({
          hash: cleanHash(tx.hash),
          blockHeight: height,
          nonce: tx.nonce || 0,
          from: tx.from,
          to: tx.to || null,
          value: tx.value || '0',
          data: tx.data || null,
          txType: tx.txType || 0,
          status: 'SUCCESS',
        }));

        await this.txRepo.insertTransactions(txEntities, manager);
        savedTxEntities = txEntities;

        // 3. 컨트랙트 배포 트랜잭션 감지 및 미검증 컨트랙트 레코드 생성 (검증 전에는 이름/ABI 없음)
        for (const tx of blockData.transactions) {
          if (tx.contractAddress) {
            const existing = await this.contractRepo.findOneByAddress(tx.contractAddress, manager);
            if (!existing) {
              await this.contractRepo.createContract(
                {
                  address: tx.contractAddress,
                  creator: tx.from,
                  bytecode: tx.data || '0x',
                  name: null,
                  isVerified: false,
                  sourceCode: null,
                  compilerVersion: null,
                  abi: null,
                  verifiedAt: null,
                },
                manager,
              );

              this.logger.log(`[Indexer] Detected new unverified contract deployed: ${tx.contractAddress} by ${tx.from}`);
            }
          }
        }
      }

      this.logger.log(
        `[Indexer] Indexed Block #${savedBlock.height} (${savedBlock.hash.slice(0, 10)}...) with ${savedBlock.txCount} txs`,
      );
    });

    // 4. UserOperation 비동기 안전 저장 (기존 파이프라인과 격리)
    if (userOpEntities.length > 0) {
      try {
        await this.userOpRepo.insertUserOperations(userOpEntities);
        this.logger.log(`[Indexer] Persisted ${userOpEntities.length} UserOperation(s) for block #${height}`);
      } catch (err: any) {
        this.logger.warn(`[Indexer] Failed to persist UserOperations: ${err.message}`);
      }
    }

    // 5. Redis Pub/Sub 실시간 이벤트 발행 (scan-api 웹소켓 게이트웨이 연동)
    if (savedBlockEntity) {
      const blockTimestampIso =
        savedBlockEntity.timestamp instanceof Date
          ? savedBlockEntity.timestamp.toISOString()
          : new Date().toISOString();

      const blockPayload = {
        height: savedBlockEntity.height,
        hash: savedBlockEntity.hash,
        prevHash: savedBlockEntity.prevHash,
        stateRoot: savedBlockEntity.stateRoot,
        proposer: savedBlockEntity.proposer,
        txCount: savedBlockEntity.txCount,
        timestamp: blockTimestampIso,
        finalized: true,
      };

      try {
        await this.redis.publish('chord:blocks', JSON.stringify(blockPayload));
      } catch (pubErr: any) {
        this.logger.warn(`[Indexer] Failed to publish block to Redis: ${pubErr.message}`);
      }

      if (savedTxEntities.length > 0) {
        for (const tx of savedTxEntities) {
          let methodName = 'Transfer';
          if (!tx.to) {
            methodName = 'Contract Deploy';
          } else if (tx.data && tx.data.startsWith('0xa9059cbb')) {
            methodName = 'transfer';
          } else if (tx.data && tx.data.startsWith('0x4e71d92d')) {
            methodName = 'claim';
          }

          const txPayload = {
            hash: tx.hash,
            blockHeight: tx.blockHeight,
            from: tx.from,
            to: tx.to,
            value: tx.value,
            data: tx.data,
            txType: tx.txType,
            status: tx.status,
            methodName,
            createdAt: blockTimestampIso,
          };

          try {
            await this.redis.publish('chord:txs', JSON.stringify(txPayload));
          } catch (pubErr: any) {
            this.logger.warn(`[Indexer] Failed to publish tx to Redis: ${pubErr.message}`);
          }
        }
      }

      try {
        const totalTxs = await this.txRepo.countTotal();
        await this.redis.publish(
          'chord:stats',
          JSON.stringify({
            latestBlockHeight: savedBlockEntity.height,
            totalTransactions: totalTxs,
            latestStateRoot: savedBlockEntity.stateRoot,
          }),
        );
      } catch (err: any) {
        this.logger.warn(`[Indexer] Failed to publish network stats: ${err.message}`);
      }
    }
  }

  private async fetchRpcBlockNumber(): Promise<number> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
    });
    const json: any = await res.json();
    return parseInt(json.result, 16) || 0;
  }

  private async fetchRpcBlock(height: number): Promise<any> {
    // 1. Fetch block from node RPC
    const hexHeight = '0x' + height.toString(16);
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBlockByNumber', params: [hexHeight, false], id: 1 }),
    });
    const json: any = await res.json();
    const b = json?.result;

    const txs: any[] = [];
    if (b && Array.isArray(b.transactions)) {
      for (const item of b.transactions) {
        const txHash = typeof item === 'string' ? item : item.hash;
        const cleanTxHash = cleanHash(txHash);

        // 1. Fetch raw transaction by hash
        let rpcTx: any = null;
        try {
          const tRes = await fetch(this.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getTransactionByHash', params: [cleanTxHash], id: 1 }),
          });
          const tJson: any = await tRes.json();
          rpcTx = tJson?.result;
        } catch (e) {
          this.logger.error(`Failed to fetch eth_getTransactionByHash for ${cleanTxHash}: ${e}`);
        }

        // 2. Fetch receipt for tx
        let receipt: any = null;
        try {
          const rRes = await fetch(this.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getTransactionReceipt', params: [cleanTxHash], id: 1 }),
          });
          const rJson: any = await rRes.json();
          receipt = rJson?.result;
        } catch (e) {
          this.logger.error(`Failed to fetch eth_getTransactionReceipt for ${cleanTxHash}: ${e}`);
        }

        const isDeploy = !rpcTx?.to && (!receipt?.to || receipt?.contractAddress);
        const contractAddr = receipt?.contractAddress || (isDeploy ? '0x4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6' : null);

        let valDec = '0';
        if (rpcTx?.value) {
          try {
            valDec = BigInt(rpcTx.value).toString(10);
          } catch {
            valDec = '0';
          }
        }

        const rawData = rpcTx?.input || rpcTx?.data || '0x';
        const fromAddr = rpcTx?.from || receipt?.from || '0xa983D897D00482FEEf3000Ad2BEEf358B9fA06bC';
        const toAddr = isDeploy ? null : (rpcTx?.to || receipt?.to || null);

        txs.push({
          hash: cleanTxHash,
          from: fromAddr,
          to: toAddr,
          contractAddress: contractAddr,
          value: valDec,
          data: rawData,
          nonce: rpcTx?.nonce ? parseInt(rpcTx.nonce, 16) : 0,
          logs: receipt?.logs || [],
        });
      }
    }

    const isGenesis = height === 0;
    const isZeroHash = !b?.hash || b.hash === '0x0000000000000000000000000000000000000000000000000000000000000000';
    const finalHash = isZeroHash && b?.stateRoot
      ? b.stateRoot
      : (b?.hash || `0xchordblock${height.toString().padStart(50, '0')}`);

    return {
      height,
      hash: finalHash,
      prevHash: b?.parentHash || `0xprev${(height - 1).toString().padStart(54, '0')}`,
      stateRoot: b?.stateRoot || '0x0',
      proposer: isGenesis ? 'Validator #1 (BFT Leader)' : (b?.miner || b?.proposer || '0xa983D897D00482FEEf3000Ad2BEEf358B9fA06bC'),
      timestamp: b?.timestamp ? new Date(parseInt(b.timestamp, 16) * 1000).toISOString() : new Date().toISOString(),
      transactions: txs,
    };
  }
}

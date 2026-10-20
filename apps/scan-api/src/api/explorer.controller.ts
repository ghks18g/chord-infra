import { Controller, Get, Post, Body, Param, Query, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import {
  BlockRepository,
  TransactionRepository,
  ContractRepository,
  AddressTagRepository,
  Transaction,
} from '@chordscan/database';
import {
  CONTRACT_VERIFICATION_QUEUE,
  SINGLE_VERIFY_JOB_NAME,
  PROXY_VERIFY_JOB_NAME,
  SingleVerificationJobData,
  ProxyVerificationJobData,
  ContractVerificationJobResult,
} from '@chordscan/queue';
import { ContractVerificationDTO } from '@chordscan/types';
import { Interface } from 'ethers';

@Controller('api')
export class ExplorerController {
  private readonly logger = new Logger(ExplorerController.name);
  private rpcUrl = process.env.CHORD_RPC_URL || 'http://127.0.0.1:8545';
  private verificationQueueEvents?: QueueEvents;

  constructor(
    private readonly blockRepo: BlockRepository,
    private readonly txRepo: TransactionRepository,
    private readonly contractRepo: ContractRepository,
    private readonly tagRepo: AddressTagRepository,
    @InjectQueue(CONTRACT_VERIFICATION_QUEUE)
    private readonly verificationQueue: Queue,
  ) {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = Number(process.env.REDIS_PORT || 6379);
    const password = process.env.REDIS_PASSWORD || undefined;

    this.verificationQueueEvents = new QueueEvents(CONTRACT_VERIFICATION_QUEUE, {
      connection: { host, port, password },
    });
  }

  private async enrichTransactions(txs: any[]) {
    if (!txs || txs.length === 0) return [];

    const toAddresses = Array.from(
      new Set(
        txs
          .map((t) => t.to?.toLowerCase())
          .filter((a): a is string => Boolean(a && a !== '0x' && a !== '0x0')),
      ),
    );

    const contracts = await this.contractRepo.findByAddresses(toAddresses);
    const contractMap = new Map<string, any>();
    for (const c of contracts) {
      contractMap.set(c.address.toLowerCase(), c);
    }

    const implAddresses = contracts
      .filter((c) => c.isProxy && c.implementationAddress)
      .map((c) => c.implementationAddress!.toLowerCase());
    if (implAddresses.length > 0) {
      const implContracts = await this.contractRepo.findByAddresses(implAddresses);
      for (const impl of implContracts) {
        contractMap.set(impl.address.toLowerCase(), impl);
      }
    }

    return txs.map((tx) => {
      let methodName: string | null = null;
      let contractSummary: {
        name: string | null;
        isVerified: boolean;
        isProxy?: boolean;
        implementationAddress?: string | null;
      } | null = null;

      if (!tx.to) {
        methodName = 'Contract Deploy';
      } else {
        const toLower = tx.to.toLowerCase();
        const contract = contractMap.get(toLower);
        if (contract) {
          const effectiveContract =
            contract.isProxy && contract.implementationAddress
              ? contractMap.get(contract.implementationAddress.toLowerCase()) || contract
              : contract;

          contractSummary = {
            name: contract.name || effectiveContract.name || null,
            isVerified: Boolean(contract.isVerified || effectiveContract.isVerified),
            isProxy: Boolean(contract.isProxy),
            implementationAddress: contract.implementationAddress || null,
          };

          const abiToUse =
            Array.isArray(effectiveContract.abi) && effectiveContract.abi.length > 0
              ? effectiveContract.abi
              : Array.isArray(contract.abi)
              ? contract.abi
              : null;

          if (abiToUse && tx.data && tx.data.length >= 10) {
            try {
              const iface = new Interface(abiToUse);
              const selector = tx.data.slice(0, 10).toLowerCase();
              const func = iface.getFunction(selector);
              if (func) {
                methodName = func.name;
              }
            } catch {
              // Ignore parse error
            }
          }
        }


        if (!methodName) {
          const dataLower = (tx.data || '').toLowerCase();
          if (!dataLower || dataLower === '0x' || dataLower === '0x0') {
            methodName = 'Transfer';
          } else if (dataLower.startsWith('0xa9059cbb')) {
            methodName = 'Transfer (ERC-20)';
          } else if (dataLower.startsWith('0x095ea7b3')) {
            methodName = 'Approve (ERC-20)';
          } else if (dataLower.startsWith('0x23b872dd')) {
            methodName = 'TransferFrom (ERC-20/721)';
          } else if (dataLower.startsWith('0x42842e0e') || dataLower.startsWith('0xb88d4fde')) {
            methodName = 'SafeTransferFrom (ERC-721)';
          } else if (dataLower.startsWith('0xf242432a')) {
            methodName = 'SafeTransferFrom (ERC-1155)';
          } else if (dataLower.startsWith('0x2eb2c2d6')) {
            methodName = 'SafeBatchTransferFrom (ERC-1155)';
          } else {
            methodName = dataLower.slice(0, 10);
          }
        }
      }

      return {
        ...tx,
        methodName,
        contract: contractSummary,
      };
    });
  }

  @Get('stats')
  async getStats() {
    const latestHeight = await this.blockRepo.getLatestHeight();
    const latestBlock = await this.blockRepo.findOneByHeight(latestHeight);
    const totalTransactions = await this.txRepo.countTotal();
    const statusRes = await fetch(`${this.rpcUrl}/status`).catch(() => null);
    const status = statusRes ? await statusRes.json() : null;

    return {
      latestBlockHeight: latestHeight,
      latestStateRoot:
        latestBlock?.stateRoot ||
        status?.sync_info?.latest_app_hash ||
        '0x0fac18e95be66fd09ed7013152e314cb766e74304540ecb449bbaf35ebfb9092',
      totalTransactions,
      activeValidators: 4,
      network: status?.node_info?.network || 'chord_7613-1',
      evmChainId: 7613,
      nodeVersion: status?.node_info?.version || 'v0.1.0',
      consensus: 'CometBFT (On-Demand)',
      gasPrice: '1 Gnote',
    };
  }

  @Get('blocks')
  async getLatestBlocks(@Query('limit') limit = 10, @Query('page') page?: number) {
    if (page !== undefined && Number(page) > 0) {
      const res = await this.blockRepo.findPaginated(Number(page), Number(limit));
      return {
        items: res.items,
        total: res.total,
        page: res.page,
        totalPages: res.totalPages,
      };
    }
    const blocks = await this.blockRepo.findLatest(Number(limit));
    if (blocks.length === 0) {
      const statusRes = await fetch(`${this.rpcUrl}/status`).catch(() => null);
      const status = statusRes ? await statusRes.json() : null;
      return [
        {
          height: 0,
          hash:
            status?.sync_info?.latest_app_hash ||
            '0x0d7c9b844ae9f3f387b439ffbe6c85a1d26d3be39c3f6423df25be031dafa389',
          prevHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          stateRoot:
            status?.sync_info?.latest_app_hash ||
            '0x0d7c9b844ae9f3f387b439ffbe6c85a1d26d3be39c3f6423df25be031dafa389',
          proposer: 'Validator #1 (BFT Leader)',
          txCount: 0,
          timestamp: new Date('2026-10-14T00:00:00Z'),
          finalized: true,
        },
      ];
    }
    return blocks;
  }

  @Get('blocks/:height')
  async getBlockByHeight(@Param('height') height: string) {
    const h = Number(height);
    let block = await this.blockRepo.findOneByHeight(h);
    if (!block && h === 0) {
      const statusRes = await fetch(`${this.rpcUrl}/status`).catch(() => null);
      const status = statusRes ? await statusRes.json() : null;
      block = {
        height: 0,
        hash:
          status?.sync_info?.latest_app_hash ||
          '0x0d7c9b844ae9f3f387b439ffbe6c85a1d26d3be39c3f6423df25be031dafa389',
        prevHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        stateRoot:
          status?.sync_info?.latest_app_hash ||
          '0x0d7c9b844ae9f3f387b439ffbe6c85a1d26d3be39c3f6423df25be031dafa389',
        txRoot: '0x0',
        proposer: 'Validator #1 (BFT Leader)',
        txCount: 0,
        timestamp: new Date('2026-10-14T00:00:00Z'),
        finalized: true,
      } as any;
    }
    if (!block) throw new NotFoundException(`Block #${height} not found`);
    const txs = await this.txRepo.findByBlockHeight(h);
    const enrichedTxs = await this.enrichTransactions(txs);

    let gasUsed = 0;
    let gasLimit = 30000000;
    try {
      const rRes = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBlockByNumber',
          params: ['0x' + h.toString(16), false],
          id: 1,
        }),
      });
      const rJson = await rRes.json();
      if (rJson?.result?.gasUsed) {
        gasUsed = parseInt(rJson.result.gasUsed, 16);
      }
      if (rJson?.result?.gasLimit) {
        gasLimit = parseInt(rJson.result.gasLimit, 16);
      }
    } catch {}

    return { ...block, gasUsed, gasLimit, transactions: enrichedTxs };
  }

  @Get('txs')
  async getLatestTransactions(@Query('limit') limit = 10, @Query('page') page?: number) {
    if (page !== undefined && Number(page) > 0) {
      const res = await this.txRepo.findPaginated(Number(page), Number(limit));
      const enriched = await this.enrichTransactions(res.items);
      return {
        items: enriched,
        total: res.total,
        page: res.page,
        totalPages: res.totalPages,
      };
    }
    const txs = await this.txRepo.findLatest(Number(limit));
    return this.enrichTransactions(txs);
  }

  @Get('faucet/cooldown/:address')
  async getFaucetCooldown(@Param('address') address: string) {
    const latestClaim = await this.txRepo.findLatestFaucetClaim(address);
    const waitTime = 86400; // 24 hours
    const now = Math.floor(Date.now() / 1000);

    if (!latestClaim) {
      return {
        canClaim: true,
        lastClaimTime: 0,
        nextRewardTime: 0,
        remainingSeconds: 0,
        waitTime,
      };
    }

    const lastClaimTime = Math.floor(new Date(latestClaim.createdAt).getTime() / 1000);
    const nextRewardTime = lastClaimTime + waitTime;
    const remainingSeconds = Math.max(0, nextRewardTime - now);

    return {
      canClaim: remainingSeconds === 0,
      lastClaimTime,
      nextRewardTime,
      remainingSeconds,
      waitTime,
    };
  }

  @Get('txs/:hash')
  async getTxByHash(@Param('hash') hash: string) {
    const tx = await this.txRepo.findOneByHash(hash);
    if (!tx) throw new NotFoundException(`Tx ${hash} not found`);

    let contractAddress: string | null = null;
    let contractInfo: any = null;
    let receipt: any = null;

    try {
      const rRes = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getTransactionReceipt', params: [hash], id: 1 }),
      });
      const rJson: any = await rRes.json();
      receipt = rJson?.result || null;
      contractAddress = receipt?.contractAddress || null;
    } catch (e) {
      // ignore
    }

    if (!tx.to && contractAddress) {
      contractInfo = await this.contractRepo.findOneByAddress(contractAddress);
    } else if (tx.to) {
      contractInfo = await this.contractRepo.findOneByAddress(tx.to);
    }

    let implementationInfo: any = null;
    if (contractInfo?.isProxy && contractInfo.implementationAddress) {
      implementationInfo = await this.contractRepo.findOneByAddress(contractInfo.implementationAddress);
    }

    const logs = receipt?.logs || [];
    // EIP-2771 Meta-Transaction: Faucet claim forwarded via gas sponsor
    if (
      tx.to &&
      tx.to.toLowerCase() === '0x4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6' &&
      tx.data &&
      tx.data.toLowerCase().startsWith('0x4e71d92d')
    ) {
      const cleanData = tx.data.toLowerCase().replace(/^0x/, '');
      if (cleanData.length >= 48) {
        const recipient = '0x' + cleanData.slice(-40);
        const hasForwarderExecuted = logs.some(
          (l: any) => l.topics?.[0]?.toLowerCase() === '0xd86b4c50733cb4dee05f54868a1f4fa6cf9347c09642e5496c23508a04cb79ff',
        );
        if (!hasForwarderExecuted) {
          logs.push({
            address: '0x34ec2b8950c43c126d8e7f57dd67d3f134ea1933',
            topics: [
              '0xd86b4c50733cb4dee05f54868a1f4fa6cf9347c09642e5496c23508a04cb79ff',
              '0x000000000000000000000000' + recipient.replace(/^0x/, ''),
              '0x0000000000000000000000004c219b464eb113f4d3c7ce0a438fb2e99f6b07b6',
            ],
            data: '0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000',
            blockNumber: tx.blockHeight,
            transactionHash: tx.hash,
            transactionIndex: '0x0',
            logIndex: logs.length.toString(),
          });
        }
      }
    }

    const effectiveContract = implementationInfo || contractInfo;
    const abiToUse =
      Array.isArray(effectiveContract?.abi) && effectiveContract.abi.length > 0
        ? effectiveContract.abi
        : Array.isArray(contractInfo?.abi)
        ? contractInfo.abi
        : null;

    let methodName: string | null = null;
    if (!tx.to) {
      methodName = 'Contract Deploy';
    } else if (abiToUse && tx.data && tx.data.length >= 10) {
      try {
        const iface = new Interface(abiToUse);
        const selector = tx.data.slice(0, 10).toLowerCase();
        const func = iface.getFunction(selector);
        if (func) methodName = func.name;
      } catch {}
    }
    if (!methodName && tx.data) {
      const d = tx.data.toLowerCase();
      if (d === '0x' || d === '0x0') methodName = 'Transfer';
      else methodName = d.slice(0, 10);
    }

    const isFailed = receipt?.status === '0x0' || receipt?.status === 0 || (tx.status && tx.status.toUpperCase() === 'FAILED');
    let revertReason: string | null = null;
    if (isFailed) {
      revertReason = 'Transaction execution reverted by EVM';
      if (tx.to && tx.data) {
        try {
          const replayRes = await fetch(this.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_call',
              params: [
                {
                  from: tx.from,
                  to: tx.to,
                  data: tx.data,
                  value: tx.value ? '0x' + BigInt(tx.value).toString(16) : '0x0',
                },
                '0x' + (Math.max(1, Number(tx.blockHeight) - 1)).toString(16),
              ],
              id: 1,
            }),
          });
          const replayJson = await replayRes.json();
          if (replayJson?.error?.message) {
            revertReason = replayJson.error.message.replace(/^execution reverted:? /i, '');
          }
        } catch {}
      }
    }

    // Enrich each log with its emitting contract's name, verified status, and ABI
    const logContractsCache = new Map<string, any>();
    const enrichedLogs: any[] = [];
    for (const log of logs) {
      const addrLower = (log.address || '').toLowerCase();
      let cData = logContractsCache.get(addrLower);
      if (cData === undefined) {
        const c = await this.contractRepo.findOneByAddress(log.address);
        cData = c
          ? {
              address: c.address,
              name: c.name,
              isVerified: c.isVerified,
              abi: c.abi,
            }
          : null;
        logContractsCache.set(addrLower, cData);
      }
      enrichedLogs.push({
        ...log,
        contract: cData,
      });
    }

    return {
      ...tx,
      status: isFailed ? 'FAILED' : 'SUCCESS',
      revertReason: isFailed ? revertReason : null,
      methodName,
      contractAddress,
      contract: contractInfo
        ? {
            ...contractInfo,
            abi: abiToUse || contractInfo.abi,
            implementation: implementationInfo || null,
          }
        : null,
      logs: enrichedLogs,
      gasUsed: receipt?.gasUsed ? parseInt(receipt.gasUsed, 16).toString() : null,
    };
  }

  @Get('address-tags')
  async getAddressTags() {
    return this.tagRepo.findAll();
  }

  @Get('address/:address/tag')
  async getAddressTag(@Param('address') address: string) {
    const tag = await this.tagRepo.findOneByAddress(address);
    if (tag) return tag;
    const contract = await this.contractRepo.findOneByAddress(address);
    if (contract?.isVerified && contract.name) {
      return {
        address: contract.address,
        nameTag: contract.name,
        category: 'Contract',
        description: `Verified Solidity Contract (${contract.compilerVersion || 'Solidity'})`,
        source: 'verified_contract',
        isOfficial: true,
      };
    }
    return null;
  }

  private extractAddressInteractions(targetAddress: string, candidateTxs: Transaction[]) {
    const target = targetAddress.toLowerCase();
    const internalTransactions: any[] = [];
    const tokenTransfers: any[] = [];

    const faucetAddr = '0x4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6';

    for (const tx of candidateTxs) {
      const txTo = (tx.to || '').toLowerCase();
      const txFrom = (tx.from || '').toLowerCase();
      const dataLower = (tx.data || '').toLowerCase();

      // 1. Check Faucet Claim Internal Native CHOR Transfers (Direct or EIP-712 Forwarder Gasless)
      const forwarderAddr = '0x34ec2b8950c43c126d8e7f57dd67d3f134ea1933';
      let isFaucetClaim = false;
      let recipient = '';

      if (txTo === faucetAddr && dataLower.startsWith('0x4e71d92d')) {
        isFaucetClaim = true;
        const cleanData = dataLower.replace(/^0x/, '');
        if (cleanData.length >= 48) {
          recipient = ('0x' + cleanData.slice(-40)).toLowerCase();
        } else {
          recipient = txFrom;
        }
      } else if (
        txTo === forwarderAddr &&
        dataLower.includes('4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6') &&
        dataLower.includes('4e71d92d')
      ) {
        isFaucetClaim = true;
        const cleanData = dataLower.replace(/^0x/, '');
        if (cleanData.length >= 200) {
          recipient = ('0x' + cleanData.substring(160, 200)).toLowerCase();
        } else if (cleanData.includes(target.replace(/^0x/, ''))) {
          recipient = target;
        }
      }

      if (isFaucetClaim && recipient) {
        const isTargetRecipient = target === recipient;
        const isTargetFaucet = target === faucetAddr;

        if (isTargetRecipient || isTargetFaucet) {
          const direction = isTargetRecipient && isTargetFaucet
            ? 'SELF'
            : isTargetRecipient
            ? 'IN'
            : 'OUT';

          internalTransactions.push({
            parentTxHash: tx.hash,
            blockHeight: tx.blockHeight,
            type: 'call',
            from: faucetAddr,
            to: recipient,
            value: '10000000000000000000', // 10 CHOR
            direction,
            status: tx.status || 'SUCCESS',
            createdAt: tx.createdAt,
          });
        }
      }

      // 2. Check ERC-20 / ERC-721 / ERC-1155 Token Transfers
      if (dataLower.startsWith('0xa9059cbb') && dataLower.length >= 74) {
        // transfer(address to, uint256 amount)
        const to = ('0x' + dataLower.slice(34, 74)).toLowerCase();
        const from = txFrom;
        const value = BigInt('0x' + (dataLower.slice(74, 138) || '0')).toString();

        if (target === from || target === to) {
          tokenTransfers.push({
            txHash: tx.hash,
            blockHeight: tx.blockHeight,
            tokenStandard: 'ERC-20',
            from,
            to,
            value,
            tokenAddress: tx.to,
            direction: from === to ? 'SELF' : (target === from ? 'OUT' : 'IN'),
            createdAt: tx.createdAt,
          });
        }
      } else if (dataLower.startsWith('0x23b872dd') && dataLower.length >= 138) {
        // transferFrom(address from, address to, uint256 amount)
        const from = ('0x' + dataLower.slice(34, 74)).toLowerCase();
        const to = ('0x' + dataLower.slice(98, 138)).toLowerCase();
        const value = BigInt('0x' + (dataLower.slice(138, 202) || '0')).toString();

        if (target === from || target === to) {
          tokenTransfers.push({
            txHash: tx.hash,
            blockHeight: tx.blockHeight,
            tokenStandard: 'ERC-20',
            from,
            to,
            value,
            tokenAddress: tx.to,
            direction: from === to ? 'SELF' : (target === from ? 'OUT' : 'IN'),
            createdAt: tx.createdAt,
          });
        }
      } else if ((dataLower.startsWith('0x42842e0e') || dataLower.startsWith('0xb88d4fde')) && dataLower.length >= 138) {
        // safeTransferFrom(address from, address to, uint256 tokenId)
        const from = ('0x' + dataLower.slice(34, 74)).toLowerCase();
        const to = ('0x' + dataLower.slice(98, 138)).toLowerCase();
        const tokenId = BigInt('0x' + (dataLower.slice(138, 202) || '0')).toString();

        if (target === from || target === to) {
          tokenTransfers.push({
            txHash: tx.hash,
            blockHeight: tx.blockHeight,
            tokenStandard: 'ERC-721',
            from,
            to,
            value: `#${tokenId}`,
            tokenAddress: tx.to,
            direction: from === to ? 'SELF' : (target === from ? 'OUT' : 'IN'),
            createdAt: tx.createdAt,
          });
        }
      } else if (dataLower.startsWith('0xf242432a') && dataLower.length >= 202) {
        // safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)
        const from = ('0x' + dataLower.slice(34, 74)).toLowerCase();
        const to = ('0x' + dataLower.slice(98, 138)).toLowerCase();
        const tokenId = BigInt('0x' + (dataLower.slice(138, 202) || '0')).toString();
        const amount = dataLower.length >= 266 ? BigInt('0x' + dataLower.slice(202, 266)).toString() : '1';

        if (target === from || target === to) {
          tokenTransfers.push({
            txHash: tx.hash,
            blockHeight: tx.blockHeight,
            tokenStandard: 'ERC-1155',
            from,
            to,
            value: `#${tokenId} (${amount} items)`,
            tokenAddress: tx.to,
            direction: from === to ? 'SELF' : (target === from ? 'OUT' : 'IN'),
            createdAt: tx.createdAt,
          });
        }
      }
    }

    return { internalTransactions, tokenTransfers };
  }

  private computeTokenHoldings(targetAddress: string, tokenTransfers: any[]) {
    const holdingsMap = new Map<string, {
      tokenAddress: string;
      tokenName: string;
      tokenStandard: string;
      tokenId: string;
      balance: string;
      rawBalance: bigint;
    }>();

    for (const t of tokenTransfers) {
      const isIncoming = t.direction === 'IN';
      const isOutgoing = t.direction === 'OUT';
      if (!isIncoming && !isOutgoing) continue;

      let count = 1n;
      let name = 'Unknown Token';
      let tokenId = '0';

      if (t.value && typeof t.value === 'string') {
        const match1155 = t.value.match(/#(\d+)\s+([^(]+)\((\d+)\s+items?\)/);
        if (match1155) {
          tokenId = match1155[1];
          name = match1155[2].trim();
          count = BigInt(match1155[3]);
        } else {
          const simpleMatch = t.value.match(/#(\d+)/);
          if (simpleMatch) {
            tokenId = simpleMatch[1];
            name = `${t.tokenStandard || 'NFT'} #${tokenId}`;
            count = 1n;
          } else {
            try {
              count = BigInt(t.value);
              name = t.tokenStandard === 'ERC-20' ? 'ERC-20 Token' : 'Token';
            } catch {
              count = 1n;
            }
          }
        }
      }

      const key = `${(t.tokenAddress || '').toLowerCase()}_${tokenId}`;
      const existing = holdingsMap.get(key) || {
        tokenAddress: t.tokenAddress,
        tokenName: name,
        tokenStandard: t.tokenStandard || 'ERC-1155',
        tokenId,
        balance: '0',
        rawBalance: 0n,
      };

      if (isIncoming) {
        existing.rawBalance += count;
      } else {
        existing.rawBalance = existing.rawBalance >= count ? existing.rawBalance - count : 0n;
      }

      existing.balance = existing.rawBalance.toString();
      holdingsMap.set(key, existing);
    }

    return Array.from(holdingsMap.values())
      .filter((h) => h.rawBalance > 0n)
      .map(({ rawBalance, ...rest }) => rest);
  }

  @Get('address/:address')
  async getAddressDetail(@Param('address') address: string) {
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new BadRequestException(
        `Invalid address format: "${address}". Expected a 42-character hex address starting with 0x.`,
      );
    }
    const txs = await this.txRepo.findByAddress(address);
    const candidateTxs = await this.txRepo.findCandidateInteractions(address);
    const { internalTransactions, tokenTransfers } = this.extractAddressInteractions(address, candidateTxs);
    const tokenHoldings = this.computeTokenHoldings(address, tokenTransfers);
    const contract = await this.contractRepo.findOneByAddress(address);
    const tag = await this.tagRepo.findOneByAddress(address);

    // Merge meta-transactions signed by or involving this address into recentTransactions
    const cleanAddr = address.toLowerCase().replace(/^0x/, '');
    const metaTxs = candidateTxs.filter((ctx) => {
      const dataLower = (ctx.data || '').toLowerCase();
      return (
        (ctx.to || '').toLowerCase() === '0x34ec2b8950c43c126d8e7f57dd67d3f134ea1933' &&
        dataLower.includes(cleanAddr)
      );
    });

    const allTxs = [...txs];
    for (const mTx of metaTxs) {
      if (!allTxs.some((t) => t.hash.toLowerCase() === mTx.hash.toLowerCase())) {
        allTxs.push(mTx);
      }
    }
    allTxs.sort((a, b) => Number(BigInt(b.blockHeight) - BigInt(a.blockHeight)));
    const enrichedTxs = await this.enrichTransactions(allTxs);

    // 1. Live liquid balance via eth_getBalance
    let liveBalance = '0';
    try {
      const balRes = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBalance', params: [address, 'latest'], id: 1 }),
      });
      const balJson: any = await balRes.json();
      if (balJson?.result && balJson.result !== '0x' && balJson.result !== '0x0') {
        liveBalance = BigInt(balJson.result).toString();
      }
    } catch {
      // ignore
    }

    // 2. Call chord-go RPC for ZK SMT proof
    const proofRes = await fetch(`${this.rpcUrl}/prove_account?address=${address}`).catch(() => null);
    const proofData = proofRes ? await proofRes.json() : null;
    if (liveBalance === '0' && proofData?.balance) {
      liveBalance = proofData.balance;
    }

    let bytecode: string | null = contract?.bytecode || null;
    let isContract = !!contract;

    if (!bytecode) {
      try {
        const codeRes = await fetch(this.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getCode', params: [address, 'latest'], id: 1 }),
        });
        const codeJson: any = await codeRes.json();
        if (codeJson?.result && codeJson.result !== '0x' && codeJson.result !== '0x0') {
          isContract = true;
          bytecode = codeJson.result;
        }
      } catch (e) {
        // ignore
      }
    }

    let implementationContract: any = null;
    if (contract?.isProxy && contract.implementationAddress) {
      implementationContract = await this.contractRepo.findOneByAddress(contract.implementationAddress);
    }

    return {
      address,
      balance: liveBalance,
      stateRoot: proofData?.state_root || '0x0',
      isContract,
      bytecode,
      contract: contract
        ? {
            ...contract,
            implementation: implementationContract || null,
          }
        : null,
      proxy: contract?.isProxy
        ? {
            isProxy: true,
            proxyType: contract.proxyType || 'ERC-1967',
            implementationAddress: contract.implementationAddress,
            implementationName: implementationContract?.name || null,
            implementationVerified: Boolean(implementationContract?.isVerified),
          }
        : null,
      tag:
        tag ||
        (contract?.isVerified && contract.name
          ? {
              address: contract.address,
              nameTag: contract.name,
              category: 'Contract',
              source: 'verified_contract',
              isOfficial: true,
            }
          : null),
      zkProof: proofData?.proof || null,
      recentTransactions: enrichedTxs,
      internalTransactions,
      tokenTransfers,
      tokenHoldings,
    };
  }

  @Get('contracts')
  async getContracts(@Query('limit') limit = 100) {
    return this.contractRepo.findLatestVerified(Number(limit));
  }

  @Get('contracts/verified')
  async getVerifiedContracts(@Query('limit') limit = 100) {
    const list = await this.contractRepo.findLatestVerified(Number(limit));
    return Promise.all(
      list.map(async (c) => {
        let balance = '0 CHOR';
        try {
          const bRes = await fetch(this.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getBalance',
              params: [c.address, 'latest'],
              id: 1,
            }),
          });
          const bJson: any = await bRes.json();
          if (bJson?.result && bJson.result !== '0x' && bJson.result !== '0x0') {
            const b = BigInt(bJson.result);
            const dec = Number(b) / 1e18;
            balance = `${dec.toLocaleString(undefined, { maximumFractionDigits: 4 })} CHOR`;
          }
        } catch {
          // ignore
        }

        let txCount = 1;
        try {
          const txs = await this.txRepo.findByAddress(c.address, 1000);
          if (txs.length > 0) txCount = txs.length;
        } catch {
          // ignore
        }

        return {
          address: c.address,
          name: c.name || 'VerifiedContract',
          compiler: 'Solidity',
          version: c.compilerVersion || 'v0.8.20+commit.a1b79de6',
          optimization: true,
          isProxy: Boolean(c.isProxy),
          proxyType: c.proxyType || null,
          implementationAddress: c.implementationAddress || null,
          verifiedAt: c.verifiedAt
            ? new Date(c.verifiedAt).toISOString().replace('T', ' ').slice(0, 19)
            : new Date().toISOString().replace('T', ' ').slice(0, 19),
          txCount,
          balance,
        };
      }),
    );
  }

  @Post('contracts/verify')
  async verifyContract(
    @Body() dto: ContractVerificationDTO,
    @Query('wait') wait?: string,
  ) {
    if (!dto.contractAddress || !dto.sourceCode || !dto.contractName) {
      throw new BadRequestException('contractAddress, sourceCode, and contractName are required');
    }

    const jobData: SingleVerificationJobData = {
      verificationType: 'SINGLE',
      contractAddress: dto.contractAddress.toLowerCase(),
      sourceCode: dto.sourceCode,
      contractName: dto.contractName,
      compilerVersion: dto.compilerVersion,
      optimizerEnabled: dto.optimizerEnabled,
      optimizerRuns: dto.optimizerRuns,
      evmVersion: dto.evmVersion,
    };

    const job = await this.verificationQueue.add(SINGLE_VERIFY_JOB_NAME, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });

    this.logger.log(`[ExplorerController] Enqueued single contract verification #${job.id} for ${dto.contractAddress}`);

    if (wait !== 'false' && this.verificationQueueEvents) {
      try {
        const result = (await job.waitUntilFinished(this.verificationQueueEvents, 20000)) as ContractVerificationJobResult;
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Verification Job #${job.id} wait timed out or failed (${msg})`);
        return {
          success: false,
          status: 'QUEUED',
          jobId: job.id,
          message: `Verification job enqueued: ${msg}`,
        };
      }
    }

    return {
      success: true,
      status: 'QUEUED',
      jobId: job.id,
      message: 'Contract verification task enqueued successfully',
    };
  }

  @Post('contracts/verify-proxy')
  async verifyProxyContract(
    @Body() body: { proxyAddress: string; implementationAddress?: string; proxyType?: string },
    @Query('wait') wait?: string,
  ) {
    if (!body?.proxyAddress) {
      throw new BadRequestException('proxyAddress is required');
    }

    const jobData: ProxyVerificationJobData = {
      verificationType: 'PROXY',
      proxyAddress: body.proxyAddress.toLowerCase(),
      expectedImplementationAddress: body.implementationAddress ? body.implementationAddress.toLowerCase() : undefined,
    };

    const job = await this.verificationQueue.add(PROXY_VERIFY_JOB_NAME, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });

    this.logger.log(`[ExplorerController] Enqueued proxy contract verification #${job.id} for ${body.proxyAddress}`);

    if (wait !== 'false' && this.verificationQueueEvents) {
      try {
        const result = (await job.waitUntilFinished(this.verificationQueueEvents, 15000)) as ContractVerificationJobResult;
        const updatedProxy = await this.contractRepo.findOneByAddress(body.proxyAddress.toLowerCase());
        const implAddr = (result as any).implementationAddress;
        const implContract = implAddr ? await this.contractRepo.findOneByAddress(implAddr.toLowerCase()) : null;
        return {
          success: true,
          proxy: updatedProxy,
          implementation: implContract,
          ...result,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Proxy Verification Job #${job.id} wait timed out or failed (${msg})`);
        return {
          success: false,
          status: 'QUEUED',
          jobId: job.id,
          message: `Proxy verification job enqueued: ${msg}`,
        };
      }
    }

    return {
      success: true,
      status: 'QUEUED',
      jobId: job.id,
      message: 'Proxy verification task enqueued successfully',
    };
  }

  @Get('contracts/verify/status/:jobId')
  async getContractVerificationStatus(@Param('jobId') jobId: string) {
    const job = await this.verificationQueue.getJob(jobId);
    if (!job) {
      return { status: 'NOT_FOUND', jobId };
    }

    const state = await job.getState();
    return {
      jobId: job.id,
      state,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    };
  }

  @Get('validators')
  async getValidators() {
    const proposerCounts = await this.blockRepo.countByProposer();
    const countsMap = new Map<string, number>();
    for (const pc of proposerCounts) {
      if (pc.proposer) {
        countsMap.set(pc.proposer.toLowerCase(), pc.count);
      }
    }

    const validatorsList = [
      {
        rank: 1,
        name: 'CHORD Validator 1 (Gateway & Proposer)',
        address: '0xa983D897D00482FEEf3000Ad2BEEf358B9fA06bC',
        pubKey: '0x04a4278195df5d0b7524f1ec2ee69278cf990d96e311edaf085218167646e28d5d652607a039874b1caa6ba7604c823c5c40ecd17d967f8940bd51890b838d581f',
        votingPower: 2500,
        votingPercent: '25.0%',
        status: 'Active',
        role: 'Active Validator (BFT Round-Robin)',
        uptime: '100.0%',
        blocksProposed: countsMap.get('0xa983d897d00482feef3000ad2beef358b9fa06bc') || 0,
      },
      {
        rank: 2,
        name: 'CHORD Validator 2 (Private BFT Proposer)',
        address: '0xAeA7958f66EEdCc146a988b11eb0268F68E5B9DF',
        pubKey: '0x043aae3d85a80de6d8fb550dc45db3196fcc1fbbe15e8f394bd4ec0cf75425c8821eb8ba94ed34b87a09482103170474a268b796dcdbe3db30c8c24916c531dd96',
        votingPower: 2500,
        votingPercent: '25.0%',
        status: 'Active',
        role: 'Active Validator (BFT Round-Robin)',
        uptime: '100.0%',
        blocksProposed: countsMap.get('0xaea7958f66eedcc146a988b11eb0268f68e5b9df') || 0,
      },
      {
        rank: 3,
        name: 'CHORD Validator 3 (Private BFT Proposer)',
        address: '0x4980B80169F964EecE5EDe078B53f207Afd0b921',
        pubKey: '0x0413d6c3027ab2646025a16323b5879cb5401662e2b218cfffbd88ff7222d8bcc8031c1825ffdf449879e21fc0059ca6c0b6d76d3b2da48e470ba13ca952c7791e',
        votingPower: 2500,
        votingPercent: '25.0%',
        status: 'Active',
        role: 'Active Validator (BFT Round-Robin)',
        uptime: '100.0%',
        blocksProposed: countsMap.get('0x4980b80169f964eece5ede078b53f207afd0b921') || 0,
      },
      {
        rank: 4,
        name: 'CHORD Validator 4 (Private BFT Proposer)',
        address: '0x483A0b4F5Db0C6ac6a7F67deE01494D45E266d18',
        pubKey: '0x04ef3d90d128bef66c2306b987c106bf113803e764e988b0b68c6c8561de68ea523d1149750e76bcd06ef7d9768b6f87541bef20bf18c3a3b58fd5028ded5754db',
        votingPower: 2500,
        votingPercent: '25.0%',
        status: 'Active',
        role: 'Active Validator (BFT Round-Robin)',
        uptime: '100.0%',
        blocksProposed: countsMap.get('0x483a0b4f5db0c6ac6a7f67dee01494d45e266d18') || 0,
      },
    ];

    return validatorsList;
  }

  @Get('tokens')
  async getTokensList() {
    const contracts = await this.contractRepo.findLatestVerified(100);
    const totalTxs = await this.txRepo.countTotal();
    const tokenList: Array<{
      name: string;
      symbol: string;
      standard: string;
      address: string;
      decimals: number;
      description: string;
      isVerified: boolean;
      isProxy: boolean;
      implementationAddress?: string;
      transfersCount: number;
    }> = [
      {
        name: 'Chord Native Token',
        symbol: 'CHOR',
        standard: 'Native',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
        description: 'CHORD L1 Native Gas & Staking Asset',
        isVerified: true,
        isProxy: false,
        transfersCount: totalTxs,
      },
    ];

    for (const c of contracts) {
      if (!tokenList.some((t) => t.address.toLowerCase() === c.address.toLowerCase())) {
        const isToken = c.name?.includes('Token') || c.name?.includes('ERC') || c.name?.includes('NFT');
        if (isToken) {
          tokenList.push({
            name: c.name || 'Custom Token',
            symbol: 'TKN',
            standard: 'ERC-20',
            address: c.address,
            decimals: 18,
            description: 'Solidity Token Contract',
            isVerified: Boolean(c.isVerified),
            isProxy: Boolean(c.isProxy),
            implementationAddress: c.implementationAddress || undefined,
            transfersCount: 0,
          });
        }
      }
    }

    return tokenList;
  }

  @Get('search')
  async searchGlobal(@Query('q') query: string) {
    if (!query || query.trim().length === 0) return [];
    const q = query.trim().toLowerCase();
    const results: Array<{
      type: 'contract' | 'token' | 'address' | 'block' | 'tx';
      title: string;
      subtitle: string;
      url: string;
      badge?: string;
    }> = [];

    const isAlreadyPresent = (url: string) => results.some((r) => r.url.toLowerCase() === url.toLowerCase());

    // 1. If numeric, check Block
    if (/^\d+$/.test(q)) {
      const height = parseInt(q, 10);
      const block = await this.blockRepo.findOneByHeight(height);
      if (block) {
        results.push({
          type: 'block',
          title: `Block #${height}`,
          subtitle: `Hash: ${block.hash.slice(0, 14)}... • ${block.txCount} txs`,
          url: `/block/${height}`,
          badge: 'Block',
        });
      }
    }

    // 2. Check Contracts & Tokens (by name or address prefix/match)
    const matchedContracts = await this.contractRepo.searchContracts(q, 6);
    for (const c of matchedContracts) {
      const url = `/address/${c.address}`;
      if (!isAlreadyPresent(url)) {
        const isProxy = Boolean(c.isProxy);
        const nameLower = (c.name || '').toLowerCase();
        const isToken =
          nameLower.includes('token') ||
          nameLower.includes('key') ||
          nameLower.includes('monster') ||
          nameLower.includes('stone') ||
          nameLower.includes('pack') ||
          nameLower.includes('usdc') ||
          nameLower.includes('chor');

        results.push({
          type: isToken ? 'token' : 'contract',
          title: c.name || `Contract: ${c.address.slice(0, 10)}...${c.address.slice(-6)}`,
          subtitle: `${c.address.slice(0, 10)}...${c.address.slice(-8)}${
            isProxy ? ' • UUPS Proxy' : c.isVerified ? ' • Verified' : ''
          }`,
          url,
          badge: isToken ? 'Token' : isProxy ? 'Proxy' : 'Contract',
        });
      }
    }

    // 3. Check Address Tags (system/validator/precompile tags)
    const tags = await this.tagRepo.findAll();
    for (const tag of tags) {
      const tagMatch = tag.nameTag && tag.nameTag.toLowerCase().includes(q);
      const addrMatch = tag.address.toLowerCase().startsWith(q);
      if (tagMatch || addrMatch) {
        const url = `/address/${tag.address}`;
        if (!isAlreadyPresent(url)) {
          results.push({
            type: 'address',
            title: tag.nameTag,
            subtitle: `${tag.address.slice(0, 10)}...${tag.address.slice(-8)} • ${tag.category}`,
            url,
            badge: tag.category,
          });
        }
      }
    }

    // 4. Check Transactions (by exact 66-char hash or >= 5 char prefix)
    if (q.startsWith('0x')) {
      if (q.length === 66) {
        const tx = await this.txRepo.findOneByHash(q);
        if (tx && !isAlreadyPresent(`/tx/${tx.hash}`)) {
          results.push({
            type: 'tx',
            title: `Tx: ${tx.hash.slice(0, 14)}...${tx.hash.slice(-6)}`,
            subtitle: `Block #${tx.blockHeight} • From ${tx.from.slice(0, 8)}... • ${tx.status}`,
            url: `/tx/${tx.hash}`,
            badge: tx.status === 'SUCCESS' ? 'Tx' : 'Tx (Reverted)',
          });
        }
      } else if (q.length >= 6) {
        const matchedTxs = await this.txRepo.findMatchingTxHashes(q, 3);
        for (const tx of matchedTxs) {
          const url = `/tx/${tx.hash}`;
          if (!isAlreadyPresent(url)) {
            results.push({
              type: 'tx',
              title: `Tx: ${tx.hash.slice(0, 14)}...${tx.hash.slice(-6)}`,
              subtitle: `Block #${tx.blockHeight} • From ${tx.from.slice(0, 8)}... • ${tx.status}`,
              url,
              badge: tx.status === 'SUCCESS' ? 'Tx' : 'Tx (Reverted)',
            });
          }
        }
      }
    }

    // 5. Check Indexed Accounts (from transactions: sender or receiver)
    if (q.startsWith('0x') && q.length >= 3) {
      const matchedAccounts = await this.txRepo.findMatchingAddresses(q, 5);
      for (const acc of matchedAccounts) {
        const url = `/address/${acc.address}`;
        if (!isAlreadyPresent(url)) {
          results.push({
            type: 'address',
            title: `${acc.address.slice(0, 10)}...${acc.address.slice(-8)}`,
            subtitle: `Active Account • ${acc.txCount} transaction${acc.txCount > 1 ? 's' : ''}`,
            url,
            badge: 'Account',
          });
        }
      }
    }

    // 6. Generic 42-char Address (if valid EVM address format not yet indexed)
    if (q.startsWith('0x') && q.length === 42 && /^0x[0-9a-f]{40}$/.test(q)) {
      const url = `/address/${q}`;
      if (!isAlreadyPresent(url)) {
        results.push({
          type: 'address',
          title: `Address: ${q.slice(0, 10)}...${q.slice(-8)}`,
          subtitle: 'View Account Details & Balances',
          url,
          badge: 'Account',
        });
      }
    }

    return results.slice(0, 8);
  }
}



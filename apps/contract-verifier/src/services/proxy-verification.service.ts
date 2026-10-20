import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  ContractRepository,
  AddressTagRepository,
} from '@chordscan/database';
import {
  ProxyVerificationJobData,
  ProxyVerificationJobResult,
} from '@chordscan/queue';

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

const EIP1967_IMPLEMENTATION_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

@Injectable()
export class ProxyVerificationService {
  private readonly logger = new Logger(ProxyVerificationService.name);
  private readonly rpcUrl = process.env.CHORD_RPC_URL || 'http://127.0.0.1:8545';

  constructor(
    private readonly dataSource: DataSource,
    private readonly contractRepo: ContractRepository,
    private readonly tagRepo: AddressTagRepository,
  ) {}

  async verify(dto: ProxyVerificationJobData): Promise<ProxyVerificationJobResult> {
    const proxyAddr = dto.proxyAddress.toLowerCase();
    let implAddr = dto.expectedImplementationAddress
      ? dto.expectedImplementationAddress.toLowerCase()
      : null;

    this.logger.log(`[ProxyVerification] Verifying proxy contract at ${proxyAddr}`);

    // 1. 구현체 주소가 지정되지 않은 경우, 온체인 EIP-1967 스토리지 슬롯에서 자동 감지
    if (!implAddr) {
      implAddr = await this.detectImplementationSlot(proxyAddr);
    }

    if (!implAddr || implAddr === '0x0000000000000000000000000000000000000000') {
      throw new BadRequestException(
        'Could not automatically detect implementation address from EIP-1967 storage slot. Please provide expectedImplementationAddress manually.',
      );
    }

    // 2. 프록시 컨트랙트 존재 확인 및 온체인 바이트코드 조회
    let proxyContract = await this.contractRepo.findOneByAddress(proxyAddr);
    if (!proxyContract) {
      const proxyBytecode = await this.fetchOnChainBytecode(proxyAddr);
      proxyContract = await this.contractRepo.createContract({
        address: proxyAddr,
        creator: '0x0000000000000000000000000000000000000000',
        bytecode: proxyBytecode,
        name: 'ERC1967Proxy',
        isVerified: true,
      });
    }

    // 3. 구현체 컨트랙트 존재 확인 및 온체인 바이트코드 조회
    let implContract = await this.contractRepo.findOneByAddress(implAddr);
    if (!implContract) {
      const implBytecode = await this.fetchOnChainBytecode(implAddr);
      implContract = await this.contractRepo.createContract({
        address: implAddr,
        creator: '0x0000000000000000000000000000000000000000',
        bytecode: implBytecode,
        name: 'Implementation',
        isVerified: false,
      });
    }

    const isImplVerified = Boolean(implContract.isVerified);
    const verifiedAt = new Date();

    // 4. Sentinel 원자적 트랜잭션 전파: 프록시 매핑 갱신
    await this.dataSource.transaction(async (manager: EntityManager) => {
      await this.contractRepo.updateProxyStatus(
        proxyAddr,
        {
          isProxy: true,
          proxyType: 'ERC-1967',
          implementationAddress: implAddr,
        },
        manager,
      );

      try {
        await this.tagRepo.upsertTag(
          {
            address: proxyAddr,
            nameTag: `${implContract?.name || 'Contract'} (Proxy)`,
            category: 'Contract',
            description: `EIP-1967 Proxy pointing to ${implAddr}`,
          },
          manager,
        );
      } catch (tagErr: unknown) {
        const msg = tagErr instanceof Error ? tagErr.message : String(tagErr);
        this.logger.warn(`[ProxyVerification] Tag upsert skipped: ${msg}`);
      }
    });

    this.logger.log(
      `[ProxyVerification] Proxy ${proxyAddr} successfully mapped to implementation ${implAddr} (Impl Verified: ${isImplVerified})`,
    );

    return {
      success: true,
      proxyAddress: proxyAddr,
      implementationAddress: implAddr,
      isImplementationVerified: isImplVerified,
      verifiedAt: verifiedAt.toISOString(),
    };
  }

  private async detectImplementationSlot(proxyAddress: string): Promise<string | null> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getStorageAt',
          params: [proxyAddress, EIP1967_IMPLEMENTATION_SLOT, 'latest'],
          id: Date.now(),
        }),
      });
      const data = (await response.json()) as JsonRpcResponse<string>;
      if (data.result && data.result !== '0x' && data.result !== '0x0') {
        const hex = data.result.replace(/^0x/, '');
        const candidate = ('0x' + hex.slice(-40)).toLowerCase();
        if (candidate !== '0x0000000000000000000000000000000000000000') {
          return candidate;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[ProxyVerification] Failed to read implementation slot: ${msg}`);
    }
    return null;
  }

  private async fetchOnChainBytecode(address: string): Promise<string> {
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getCode',
        params: [address, 'latest'],
        id: Date.now(),
      }),
    });
    const data = (await response.json()) as JsonRpcResponse<string>;
    const bytecode = data.result?.trim();
    if (!bytecode || bytecode === '0x' || bytecode === '0x0') {
      return '0x';
    }
    return bytecode.toLowerCase();
  }
}

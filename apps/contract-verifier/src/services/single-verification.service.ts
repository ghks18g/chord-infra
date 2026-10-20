import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  ContractRepository,
  ContractVerificationRepository,
  AddressTagRepository,
} from '@chordscan/database';
import {
  SingleVerificationJobData,
  SingleVerificationJobResult,
} from '@chordscan/queue';
import { SolcCompilerService } from '../compiler/solc-compiler.service';
import { compareBytecodes, stripCborMetadata } from '../cbor/cbor.util';

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

@Injectable()
export class SingleVerificationService {
  private readonly logger = new Logger(SingleVerificationService.name);
  private readonly rpcUrl = process.env.CHORD_RPC_URL || 'http://127.0.0.1:8545';

  constructor(
    private readonly dataSource: DataSource,
    private readonly contractRepo: ContractRepository,
    private readonly verificationRepo: ContractVerificationRepository,
    private readonly tagRepo: AddressTagRepository,
    private readonly solcCompilerService: SolcCompilerService,
  ) {}

  async verify(dto: SingleVerificationJobData): Promise<SingleVerificationJobResult> {
    const targetAddress = dto.contractAddress.toLowerCase();
    let contract = await this.contractRepo.findOneByAddress(targetAddress);
    if (contract?.isVerified) {
      this.logger.log(`[SingleVerification] Contract ${targetAddress} is already verified`);
      return {
        success: true,
        contractAddress: targetAddress,
        contractName: contract.name || dto.contractName,
        compilerVersion: contract.compilerVersion || dto.compilerVersion,
        isProxy: Boolean(contract.isProxy),
        implementationAddress: contract.implementationAddress || undefined,
        verifiedAt: contract.verifiedAt ? contract.verifiedAt.toISOString() : new Date().toISOString(),
      };
    }

    this.logger.log(`[SingleVerification] Verifying contract ${dto.contractName} (${targetAddress})`);

    // 1. 온체인 RPC 런타임 바이트코드 조회
    const onChainBytecode = await this.fetchOnChainBytecode(targetAddress);

    // 2. solc 컴파일 수행
    const compilationResult = await this.solcCompilerService.compile({
      sourceCode: dto.sourceCode,
      contractName: dto.contractName,
      compilerVersion: dto.compilerVersion,
      optimizerEnabled: dto.optimizerEnabled,
      optimizerRuns: dto.optimizerRuns,
      evmVersion: dto.evmVersion,
    });

    // 3. EVM 표준 CBOR 메타데이터 트렁케이트 및 100% 일치 검증
    let comparison = compareBytecodes(onChainBytecode, compilationResult.deployedBytecode);
    if (!comparison.matches) {
      const cleanOnChain = stripCborMetadata(onChainBytecode);
      const cleanDeployed = stripCborMetadata(compilationResult.deployedBytecode);
      const cleanCreation = compilationResult.bytecode ? stripCborMetadata(compilationResult.bytecode) : '';

      if (
        cleanOnChain.toLowerCase().includes(cleanDeployed.slice(2).toLowerCase()) ||
        (cleanCreation && cleanOnChain.toLowerCase().includes(cleanCreation.slice(2).toLowerCase()))
      ) {
        comparison = {
          matches: true,
          cleanOnChainBytecode: cleanOnChain,
          cleanCompiledBytecode: cleanDeployed,
        };
      }
    }

    if (!comparison.matches) {
      const errorMsg = `Bytecode mismatch during verification for contract "${dto.contractName}" at ${targetAddress}:\n${comparison.diff}`;
      this.logger.error(`[SingleVerification] ${errorMsg}`);

      try {
        await this.verificationRepo.createLog({
          contractAddress: targetAddress,
          sourceCode: dto.sourceCode,
          compilerVersion: dto.compilerVersion,
          contractName: dto.contractName,
          status: 'FAILED',
          errorLog: comparison.diff,
        });
      } catch (logErr: unknown) {
        const msg = logErr instanceof Error ? logErr.message : String(logErr);
        this.logger.warn(`[SingleVerification] Failed to save failure audit log: ${msg}`);
      }

      throw new BadRequestException(errorMsg);
    }

    // 4. Sentinel 트랜잭션 전파: Contract 엔티티 상태와 VerificationAuditLog 원자적 갱신
    const verifiedAt = new Date();
    await this.dataSource.transaction(async (manager: EntityManager) => {
      if (!contract) {
        contract = await this.contractRepo.createContract(
          {
            address: targetAddress,
            creator: '0x0000000000000000000000000000000000000000',
            bytecode: onChainBytecode,
            name: dto.contractName,
            isVerified: true,
          },
          manager,
        );
      }

      await this.contractRepo.updateVerifiedStatus(
        targetAddress,
        {
          name: dto.contractName,
          compilerVersion: dto.compilerVersion,
          sourceCode: dto.sourceCode,
          abi: compilationResult.abi,
        },
        manager,
      );

      await this.verificationRepo.createLog(
        {
          contractAddress: targetAddress,
          sourceCode: dto.sourceCode,
          compilerVersion: dto.compilerVersion,
          contractName: dto.contractName,
          status: 'SUCCESS',
        },
        manager,
      );

      try {
        await this.tagRepo.upsertTag(
          {
            address: targetAddress,
            nameTag: dto.contractName,
            category: 'Contract',
            description: `Verified Contract: ${dto.contractName}`,
          },
          manager,
        );
      } catch (tagErr: unknown) {
        const msg = tagErr instanceof Error ? tagErr.message : String(tagErr);
        this.logger.warn(`[SingleVerification] Tag upsert skipped: ${msg}`);
      }
    });

    this.logger.log(`[SingleVerification] Contract ${dto.contractName} (${targetAddress}) successfully verified & published!`);

    return {
      success: true,
      contractAddress: targetAddress,
      contractName: dto.contractName,
      compilerVersion: dto.compilerVersion,
      isProxy: Boolean(contract?.isProxy),
      implementationAddress: contract?.implementationAddress || undefined,
      verifiedAt: verifiedAt.toISOString(),
    };
  }

  private async fetchOnChainBytecode(address: string): Promise<string> {
    const payload = {
      jsonrpc: '2.0',
      method: 'eth_getCode',
      params: [address, 'latest'],
      id: Date.now(),
    };

    let response: Response;
    try {
      response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Failed to reach CHORD L1 RPC at ${this.rpcUrl}: ${msg}`);
    }

    if (!response.ok) {
      throw new BadRequestException(`CHORD L1 RPC returned HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as JsonRpcResponse<string>;
    if (data.error) {
      throw new BadRequestException(`RPC error querying eth_getCode: ${data.error.message}`);
    }

    const bytecode = data.result?.trim();
    if (!bytecode || bytecode === '0x' || bytecode === '0x0') {
      throw new BadRequestException(
        `Address ${address} has no deployed bytecode on CHORD L1 (EOA or selfdestructed contract).`,
      );
    }

    return bytecode.toLowerCase();
  }
}

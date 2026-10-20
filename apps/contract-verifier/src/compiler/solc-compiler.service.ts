import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as solcImport from 'solc';

export interface SolcCompileOptions {
  sourceCode: string;
  contractName: string;
  compilerVersion?: string;
  optimizerEnabled?: boolean;
  optimizerRuns?: number;
  evmVersion?: string;
  fileName?: string;
}

export interface SolcCompilationResult {
  contractName: string;
  fileName: string;
  abi: unknown[];
  deployedBytecode: string;
  bytecode: string;
  metadata?: string;
}

export interface SolcCompilerInstance {
  version(): string;
  compile(input: string): string;
  loadRemoteVersion(
    version: string,
    callback: (error: Error | null, solcSnapshot?: SolcCompilerInstance) => void,
  ): void;
}

interface SolcStandardInput {
  language: 'Solidity';
  sources: Record<string, { content: string }>;
  settings: {
    optimizer: {
      enabled: boolean;
      runs: number;
    };
    evmVersion?: string;
    outputSelection: Record<string, Record<string, string[]>>;
  };
}

interface SolcContractOutput {
  abi: unknown[];
  evm?: {
    bytecode?: {
      object: string;
      opcodes?: string;
      sourceMap?: string;
    };
    deployedBytecode?: {
      object: string;
      opcodes?: string;
      sourceMap?: string;
    };
  };
  metadata?: string;
}

interface SolcErrorOutput {
  sourceLocation?: {
    file: string;
    start: number;
    end: number;
  };
  type: string;
  component: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  formattedMessage?: string;
}

interface SolcStandardOutput {
  errors?: SolcErrorOutput[];
  sources?: Record<string, { id: number }>;
  contracts?: Record<string, Record<string, SolcContractOutput>>;
}

const defaultSolc = solcImport as unknown as SolcCompilerInstance;

@Injectable()
export class SolcCompilerService {
  private readonly logger = new Logger(SolcCompilerService.name);
  private readonly versionCache = new Map<string, SolcCompilerInstance>();

  async compile(options: SolcCompileOptions): Promise<SolcCompilationResult> {
    const fileName = options.fileName || `${options.contractName}.sol`;
    const solcInstance = await this.resolveSolcInstance(options.compilerVersion);

    this.logger.log(
      `[SolcCompiler] Compiling ${options.contractName} (${fileName}) with solc ${solcInstance.version()}, optimizer: ${
        options.optimizerEnabled ? `enabled (runs=${options.optimizerRuns ?? 200})` : 'disabled'
      }`,
    );

    const input: SolcStandardInput = {
      language: 'Solidity',
      sources: {
        [fileName]: {
          content: options.sourceCode,
        },
      },
      settings: {
        optimizer: {
          enabled: options.optimizerEnabled ?? false,
          runs: options.optimizerRuns ?? 200,
        },
        ...(options.evmVersion ? { evmVersion: options.evmVersion } : {}),
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'metadata'],
          },
        },
      },
    };

    let rawOutput: string;
    try {
      rawOutput = solcInstance.compile(JSON.stringify(input));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Solidity compiler crashed during execution: ${msg}`);
    }

    let output: SolcStandardOutput;
    try {
      output = JSON.parse(rawOutput) as SolcStandardOutput;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Failed to parse solc compiler output: ${msg}`);
    }

    const fatalErrors = output.errors?.filter((e) => e.severity === 'error') ?? [];
    if (fatalErrors.length > 0) {
      const errorDetails = fatalErrors.map((e) => e.formattedMessage || e.message).join('\n');
      throw new BadRequestException(`Solidity compilation error:\n${errorDetails}`);
    }

    const warnings = output.errors?.filter((e) => e.severity === 'warning') ?? [];
    if (warnings.length > 0) {
      this.logger.warn(
        `[SolcCompiler] Compilation produced ${warnings.length} warning(s) for ${options.contractName}`,
      );
    }

    let targetContract: SolcContractOutput | undefined;
    let resolvedFileName = fileName;

    if (output.contracts) {
      if (output.contracts[fileName] && output.contracts[fileName][options.contractName]) {
        targetContract = output.contracts[fileName][options.contractName];
      } else {
        for (const [file, contracts] of Object.entries(output.contracts)) {
          if (contracts[options.contractName]) {
            targetContract = contracts[options.contractName];
            resolvedFileName = file;
            break;
          }
        }
      }
    }

    if (!targetContract) {
      const availableContracts: string[] = [];
      if (output.contracts) {
        for (const [file, contracts] of Object.entries(output.contracts)) {
          for (const name of Object.keys(contracts)) {
            availableContracts.push(`${file}:${name}`);
          }
        }
      }
      throw new BadRequestException(
        `Contract "${options.contractName}" not found in compilation artifacts. Available contracts: ${
          availableContracts.length > 0 ? availableContracts.join(', ') : 'none'
        }`,
      );
    }

    const deployedBytecodeRaw = targetContract.evm?.deployedBytecode?.object ?? '';
    const bytecodeRaw = targetContract.evm?.bytecode?.object ?? '';

    const deployedBytecode = deployedBytecodeRaw.startsWith('0x')
      ? deployedBytecodeRaw
      : `0x${deployedBytecodeRaw}`;

    const bytecode = bytecodeRaw.startsWith('0x')
      ? bytecodeRaw
      : `0x${bytecodeRaw}`;

    return {
      contractName: options.contractName,
      fileName: resolvedFileName,
      abi: targetContract.abi ?? [],
      deployedBytecode,
      bytecode,
      metadata: targetContract.metadata,
    };
  }

  async resolveSolcInstance(requestedVersion?: string): Promise<SolcCompilerInstance> {
    if (!requestedVersion) {
      return defaultSolc;
    }

    const version = requestedVersion.trim();
    if (version === defaultSolc.version() || defaultSolc.version().includes(version)) {
      return defaultSolc;
    }

    if (this.versionCache.has(version)) {
      const cached = this.versionCache.get(version);
      if (cached) return cached;
    }

    this.logger.log(`[SolcCompiler] Loading remote solc compiler version ${version}...`);
    try {
      const loaded = await new Promise<SolcCompilerInstance>((resolve, reject) => {
        defaultSolc.loadRemoteVersion(version, (err, solcSnapshot) => {
          if (err || !solcSnapshot) {
            return reject(err || new Error(`Failed to load remote solc ${version}`));
          }
          resolve(solcSnapshot);
        });
      });
      this.versionCache.set(version, loaded);
      this.logger.log(`[SolcCompiler] Successfully loaded and cached solc ${version}`);
      return loaded;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[SolcCompiler] Remote solc loading for ${version} failed (${msg}). Falling back to installed solc ${defaultSolc.version()}`,
      );
      return defaultSolc;
    }
  }
}

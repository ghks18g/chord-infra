export type VerificationType = 'SINGLE' | 'PROXY';

export interface SingleVerificationJobData {
  verificationType: 'SINGLE';
  contractAddress: string;
  sourceCode: string;
  compilerVersion: string;
  contractName: string;
  optimizerEnabled?: boolean;
  optimizerRuns?: number;
  evmVersion?: string;
}

export interface ProxyVerificationJobData {
  verificationType: 'PROXY';
  proxyAddress: string;
  expectedImplementationAddress?: string;
}

export type ContractVerificationJobData =
  | SingleVerificationJobData
  | ProxyVerificationJobData;

export interface SingleVerificationJobResult {
  success: boolean;
  contractAddress: string;
  contractName: string;
  compilerVersion: string;
  isProxy: boolean;
  implementationAddress?: string;
  error?: string;
  verifiedAt: string;
}

export interface ProxyVerificationJobResult {
  success: boolean;
  proxyAddress: string;
  implementationAddress: string;
  isImplementationVerified: boolean;
  error?: string;
  verifiedAt: string;
}

export type ContractVerificationJobResult =
  | SingleVerificationJobResult
  | ProxyVerificationJobResult;

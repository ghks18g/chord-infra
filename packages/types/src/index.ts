export interface BlockDTO {
  height: number;
  hash: string;
  prevHash: string;
  stateRoot: string;
  txRoot: string;
  proposer: string;
  txCount: number;
  timestamp: Date;
  finalized: boolean;
}

export type TransactionType = 'STANDARD' | 'EIP_712' | 'ZK_PAYLOAD';

export interface TransactionDTO {
  hash: string;
  blockHeight: number;
  nonce: number;
  from: string;
  to?: string | null;
  value: string;
  data?: string | null;
  txType: TransactionType;
  status: 'SUCCESS' | 'FAILED';
  createdAt: Date;
}

export interface ContractDTO {
  address: string;
  creator: string;
  bytecode: string;
  name?: string | null;
  isVerified: boolean;
  sourceCode?: string | null;
  compilerVersion?: string | null;
  abi?: unknown | null;
  verifiedAt?: Date | null;
}

export interface ContractVerificationDTO {
  contractAddress: string;
  sourceCode: string;
  compilerVersion: string;
  contractName: string;
  optimizerEnabled?: boolean;
  optimizerRuns?: number;
  evmVersion?: string;
}


export interface SMTProofDTO {
  address: string;
  balance: string;
  stateRoot: string;
  siblings: string[];
  verified: boolean;
}

export interface NetworkStatsDTO {
  latestBlockHeight: number;
  latestStateRoot: string;
  totalTransactions: number;
  totalContracts: number;
  verifiedContracts: number;
  activeValidators: number;
}

export interface ForwardRequest {
  from: string;
  to: string;
  value?: string;
  gas?: string;
  nonce?: number;
  deadline?: number;
  data: string;
}

export interface RelayDispatchDTO {
  from: string;
  to: string;
  value?: string;
  gas?: string;
  nonce?: number;
  deadline?: number;
  data: string;
  signature: string;
}

export interface RelayDispatchResultDTO {
  success: boolean;
  txHash: string;
  blockNumber?: number;
  gasUsed?: string;
  status: string;
  sponsoredBy: string;
  recipient: string;
  from: string;
}

export interface RelayerStatusDTO {
  sponsorAddress: string;
  sponsorBalance: string;
  chainId: number;
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  policies: {
    whitelist: string[];
    rateLimitPerHour: number;
    maxGasLimit: string;
  };
  stats: {
    totalDispatched: number;
    activeUsers: number;
  };
}


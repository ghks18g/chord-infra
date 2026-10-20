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

export interface RelayTxJobData {
  from: string;
  to: string;
  data: string;
  value?: string;
  gas?: string;
  nonce?: number;
  deadline?: number;
  signature: string;
  forwarderAddress?: string;
  submittedAt: number;
}

export interface RelayTxJobResult {
  success: boolean;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
  executedAt: number;
}

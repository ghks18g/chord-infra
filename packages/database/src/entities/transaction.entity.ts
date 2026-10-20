import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('transactions')
export class Transaction {
  @PrimaryColumn({ type: 'varchar', length: 66 })
  hash: string;

  @Column({ type: 'bigint' })
  @Index('idx_txs_block_height')
  blockHeight: number;

  @Column({ type: 'bigint', default: 0 })
  nonce: number;

  @Column({ type: 'varchar', length: 42 })
  @Index('idx_txs_from')
  from: string;

  @Column({ type: 'varchar', length: 42, nullable: true })
  @Index('idx_txs_to')
  to: string | null;

  @Column({ type: 'varchar', length: 78, default: '0' })
  value: string;

  @Column({ type: 'text', nullable: true })
  data: string | null;

  @Column({ type: 'smallint', default: 0 })
  txType: number; // 0: Standard ECDSA, 1: EIP-712, 2: ZK Payload

  @Column({ type: 'varchar', length: 16, default: 'SUCCESS' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

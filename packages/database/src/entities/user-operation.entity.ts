import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('user_operations')
export class UserOperation {
  @PrimaryColumn({ type: 'varchar', length: 66 })
  userOpHash: string;

  @Column({ type: 'varchar', length: 66 })
  @Index('idx_user_ops_tx_hash')
  txHash: string;

  @Column({ type: 'bigint' })
  @Index('idx_user_ops_block_height')
  blockHeight: number;

  @Column({ type: 'varchar', length: 42 })
  @Index('idx_user_ops_sender')
  sender: string;

  @Column({ type: 'varchar', length: 42, nullable: true })
  paymaster: string | null;

  @Column({ type: 'varchar', length: 78 })
  nonce: string;

  @Column({ type: 'boolean', default: true })
  success: boolean;

  @Column({ type: 'varchar', length: 78, default: '0' })
  actualGasCost: string;

  @Column({ type: 'varchar', length: 78, default: '0' })
  actualGasUsed: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('blocks')
export class Block {
  @PrimaryColumn({ type: 'bigint' })
  height: number;

  @Column({ type: 'varchar', length: 66, unique: true })
  @Index('idx_blocks_hash')
  hash: string;

  @Column({ type: 'varchar', length: 66 })
  prevHash: string;

  @Column({ type: 'varchar', length: 66 })
  stateRoot: string;

  @Column({ type: 'varchar', length: 66, default: '' })
  txRoot: string;

  @Column({ type: 'varchar', length: 42 })
  @Index('idx_blocks_proposer')
  proposer: string;

  @Column({ type: 'int', default: 0 })
  txCount: number;

  @Column({ type: 'boolean', default: true })
  finalized: boolean;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

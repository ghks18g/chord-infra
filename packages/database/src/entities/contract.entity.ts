import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('contracts')
export class Contract {
  @PrimaryColumn({ type: 'varchar', length: 42 })
  address: string;

  @Column({ type: 'varchar', length: 42 })
  @Index('idx_contracts_creator')
  creator: string;

  @Column({ type: 'text' })
  bytecode: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  name: string | null;

  @Column({ type: 'boolean', default: false })
  @Index('idx_contracts_verified')
  isVerified: boolean;

  @Column({ type: 'boolean', default: false })
  @Index('idx_contracts_proxy')
  isProxy: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  proxyType: string | null;

  @Column({ type: 'varchar', length: 42, nullable: true })
  @Index('idx_contracts_implementation')
  implementationAddress: string | null;

  @Column({ type: 'text', nullable: true })
  sourceCode: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  compilerVersion: string | null;

  @Column({ type: 'jsonb', nullable: true })
  abi: unknown | null;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}


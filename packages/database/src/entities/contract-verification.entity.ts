import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('contract_verifications')
export class ContractVerification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 42 })
  @Index('idx_verifications_contract')
  contractAddress: string;

  @Column({ type: 'text' })
  sourceCode: string;

  @Column({ type: 'varchar', length: 64 })
  compilerVersion: string;

  @Column({ type: 'varchar', length: 128 })
  contractName: string;

  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status: string; // PENDING, SUCCESS, FAILED

  @Column({ type: 'text', nullable: true })
  matchedBytecode: string | null;

  @Column({ type: 'text', nullable: true })
  errorLog: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('address_tags')
export class AddressTag {
  @PrimaryColumn({ type: 'varchar', length: 42 })
  address: string;

  @Column({ type: 'varchar', length: 128 })
  nameTag: string;

  @Column({ type: 'varchar', length: 64, default: 'General' })
  @Index('idx_address_tags_category')
  category: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 64, default: 'genesis_config' })
  source: string;

  @Column({ type: 'boolean', default: false })
  isOfficial: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

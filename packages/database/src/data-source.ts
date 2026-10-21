import { DataSource } from 'typeorm';
import { Block } from './entities/block.entity';
import { Transaction } from './entities/transaction.entity';
import { Contract } from './entities/contract.entity';
import { ContractVerification } from './entities/contract-verification.entity';
import { AddressTag } from './entities/address-tag.entity';
import { UserOperation } from './entities/user-operation.entity';

export const entities = [
  Block,
  Transaction,
  Contract,
  ContractVerification,
  AddressTag,
  UserOperation,
];

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.DATABASE_PORT) || 5432,
  username: process.env.DATABASE_USER || 'chord',
  password: process.env.DATABASE_PASSWORD || 'chordpass',
  database: process.env.DATABASE_NAME || 'chordscan',
  entities,
  synchronize: false,
});

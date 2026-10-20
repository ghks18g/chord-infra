import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block } from './entities/block.entity';
import { Transaction } from './entities/transaction.entity';
import { Contract } from './entities/contract.entity';
import { ContractVerification } from './entities/contract-verification.entity';
import { AddressTag } from './entities/address-tag.entity';
import { BlockRepository } from './repositories/block.repository';
import { TransactionRepository } from './repositories/transaction.repository';
import { ContractRepository } from './repositories/contract.repository';
import { ContractVerificationRepository } from './repositories/contract-verification.repository';
import { AddressTagRepository } from './repositories/address-tag.repository';

const entities = [Block, Transaction, Contract, ContractVerification, AddressTag];
const repositories = [
  BlockRepository,
  TransactionRepository,
  ContractRepository,
  ContractVerificationRepository,
  AddressTagRepository,
];

@Module({
  imports: [TypeOrmModule.forFeature(entities)],
  providers: repositories,
  exports: repositories,
})
export class DatabaseModule {}

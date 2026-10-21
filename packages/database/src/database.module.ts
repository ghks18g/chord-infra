import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block } from './entities/block.entity';
import { Transaction } from './entities/transaction.entity';
import { Contract } from './entities/contract.entity';
import { ContractVerification } from './entities/contract-verification.entity';
import { AddressTag } from './entities/address-tag.entity';
import { UserOperation } from './entities/user-operation.entity';
import { BlockRepository } from './repositories/block.repository';
import { TransactionRepository } from './repositories/transaction.repository';
import { ContractRepository } from './repositories/contract.repository';
import { ContractVerificationRepository } from './repositories/contract-verification.repository';
import { AddressTagRepository } from './repositories/address-tag.repository';
import { UserOperationRepository } from './repositories/user-operation.repository';

const entities = [Block, Transaction, Contract, ContractVerification, AddressTag, UserOperation];
const repositories = [
  BlockRepository,
  TransactionRepository,
  ContractRepository,
  ContractVerificationRepository,
  AddressTagRepository,
  UserOperationRepository,
];

@Module({
  imports: [TypeOrmModule.forFeature(entities)],
  providers: repositories,
  exports: repositories,
})
export class DatabaseModule {}

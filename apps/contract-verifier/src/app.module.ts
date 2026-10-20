import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DatabaseModule,
  Block,
  Transaction,
  Contract,
  ContractVerification,
  AddressTag,
} from '@chordscan/database';
import { RedisModule } from '@chordscan/redis';
import { QueueModule } from '@chordscan/queue';
import { SolcCompilerService } from './compiler/solc-compiler.service';
import { SingleVerificationService } from './services/single-verification.service';
import { ProxyVerificationService } from './services/proxy-verification.service';
import { ContractVerificationProcessor } from './processor/contract-verification.processor';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || '127.0.0.1',
      port: Number(process.env.DATABASE_PORT) || 5432,
      username: process.env.DATABASE_USER || 'chord',
      password: process.env.DATABASE_PASSWORD || 'chordpass',
      database: process.env.DATABASE_NAME || 'chordscan',
      entities: [Block, Transaction, Contract, ContractVerification, AddressTag],
      synchronize: false,
    }),
    DatabaseModule,
    RedisModule.forRoot(),
    QueueModule,
  ],
  providers: [
    SolcCompilerService,
    SingleVerificationService,
    ProxyVerificationService,
    ContractVerificationProcessor,
  ],
})
export class AppModule {}

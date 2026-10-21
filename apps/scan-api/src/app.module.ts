import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DatabaseModule,
  Block,
  Transaction,
  Contract,
  ContractVerification,
  AddressTag,
  UserOperation,
} from '@chordscan/database';
import { RedisModule } from '@chordscan/redis';
import { QueueModule } from '@chordscan/queue';
import { ExplorerController } from './api/explorer.controller';
import { RelayerModule } from './relayer/relayer.module';
import { WebSocketService } from './websocket/websocket.service';
import { UserOpsModule } from './user-ops/user-ops.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || '127.0.0.1',
      port: Number(process.env.DATABASE_PORT) || 5432,
      username: process.env.DATABASE_USER || 'chord',
      password: process.env.DATABASE_PASSWORD || 'chordpass',
      database: process.env.DATABASE_NAME || 'chordscan',
      entities: [Block, Transaction, Contract, ContractVerification, AddressTag, UserOperation],
      synchronize: false,
    }),
    DatabaseModule,
    RedisModule.forRoot(),
    QueueModule,
    RelayerModule,
    UserOpsModule,
  ],
  controllers: [ExplorerController],
  providers: [WebSocketService],
})
export class AppModule {}

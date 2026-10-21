import { Module, Controller, Get } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DatabaseModule,
  Block,
  Transaction,
  Contract,
  ContractVerification,
  AddressTag,
  UserOperation,
  BlockRepository,
} from '@chordscan/database';
import { RedisModule } from '@chordscan/redis';
import { IndexerService } from './indexer/indexer.service';

@Controller('health')
export class IndexerHealthController {
  constructor(private readonly blockRepo: BlockRepository) {}

  @Get()
  async getHealth() {
    const latest = await this.blockRepo.findLatest(1);
    return {
      status: 'OK',
      service: 'chordscan-indexer-api',
      latestBlock: latest[0]?.height ?? 0,
      timestamp: new Date().toISOString(),
    };
  }
}

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
  ],
  controllers: [IndexerHealthController],
  providers: [IndexerService],
})
export class AppModule {}

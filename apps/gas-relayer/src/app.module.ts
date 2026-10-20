import { Module } from '@nestjs/common';
import { RedisModule } from '@chordscan/redis';
import { QueueModule } from '@chordscan/queue';
import { RelayExecutionService } from './services/relay-execution.service';
import { RelayProcessor } from './processor/relay.processor';

@Module({
  imports: [
    RedisModule.forRoot(),
    QueueModule,
  ],
  providers: [
    RelayExecutionService,
    RelayProcessor,
  ],
})
export class AppModule {}

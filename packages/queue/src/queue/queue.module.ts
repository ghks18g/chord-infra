import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import {
  RELAY_TX_QUEUE,
  CONTRACT_VERIFICATION_QUEUE,
} from '../constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: async () => ({
        connection: {
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: Number(process.env.REDIS_PORT || 6379),
          password: process.env.REDIS_PASSWORD || undefined,
        },
      }),
    }),

    BullModule.registerQueue(
      { name: RELAY_TX_QUEUE },
      { name: CONTRACT_VERIFICATION_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}

import { Module } from '@nestjs/common';
import { RelayerController } from './relayer.controller';

@Module({
  controllers: [RelayerController],
})
export class RelayerModule {}

import { Module } from '@nestjs/common';
import { DatabaseModule } from '@chordscan/database';
import { UserOpsController } from './user-ops.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [UserOpsController],
  exports: [UserOpsController],
})
export class UserOpsModule {}

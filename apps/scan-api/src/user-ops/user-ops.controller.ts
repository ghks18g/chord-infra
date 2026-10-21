import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { UserOperationRepository } from '@chordscan/database';

@Controller('api/user-ops')
export class UserOpsController {
  constructor(private readonly userOpRepo: UserOperationRepository) {}

  @Get()
  async getUserOps(
    @Query('limit') limit = 25,
    @Query('offset') offset = 0,
  ) {
    const numLimit = Number(limit) || 25;
    const numOffset = Number(offset) || 0;
    return this.userOpRepo.findPaginated(numLimit, numOffset);
  }

  @Get(':userOpHash')
  async getUserOpByHash(@Param('userOpHash') userOpHash: string) {
    const op = await this.userOpRepo.findByUserOpHash(userOpHash);
    if (!op) {
      throw new NotFoundException(`UserOperation ${userOpHash} not found`);
    }
    return op;
  }
}

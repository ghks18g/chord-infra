import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UserOperation } from '../entities/user-operation.entity';

@Injectable()
export class UserOperationRepository {
  constructor(
    @InjectRepository(UserOperation)
    private readonly userOpRepo: Repository<UserOperation>,
  ) {}

  private repo(entityManager?: EntityManager): Repository<UserOperation> {
    return entityManager ? entityManager.getRepository(UserOperation) : this.userOpRepo;
  }

  async findByUserOpHash(userOpHash: string, entityManager?: EntityManager): Promise<UserOperation | null> {
    if (!userOpHash) return null;
    return this.repo(entityManager).findOne({
      where: { userOpHash },
    });
  }

  async findByTxHash(txHash: string, entityManager?: EntityManager): Promise<UserOperation[]> {
    if (!txHash) return [];
    return this.repo(entityManager).find({
      where: { txHash },
      order: { createdAt: 'ASC' },
    });
  }

  async countTotal(entityManager?: EntityManager): Promise<number> {
    return this.repo(entityManager).count();
  }

  async findPaginated(
    limit = 25,
    offset = 0,
    entityManager?: EntityManager,
  ): Promise<{ items: UserOperation[]; total: number; limit: number; offset: number }> {
    const validLimit = Math.max(1, Math.min(100, limit));
    const validOffset = Math.max(0, offset);

    const [items, total] = await this.repo(entityManager).findAndCount({
      order: { blockHeight: 'DESC', createdAt: 'DESC' },
      skip: validOffset,
      take: validLimit,
    });

    return {
      items,
      total,
      limit: validLimit,
      offset: validOffset,
    };
  }

  async countByAddress(address: string, entityManager?: EntityManager): Promise<number> {
    if (!address) return 0;
    const cleanAddr = address.toLowerCase();

    return this.repo(entityManager)
      .createQueryBuilder('op')
      .where('LOWER(op.sender) = :cleanAddr OR LOWER(op.paymaster) = :cleanAddr', { cleanAddr })
      .getCount();
  }

  async findByAddress(address: string, limit = 50, entityManager?: EntityManager): Promise<UserOperation[]> {
    if (!address) return [];
    const cleanAddr = address.toLowerCase();

    return this.repo(entityManager)
      .createQueryBuilder('op')
      .where('LOWER(op.sender) = :cleanAddr OR LOWER(op.paymaster) = :cleanAddr', { cleanAddr })
      .orderBy('op.blockHeight', 'DESC')
      .take(limit)
      .getMany();
  }

  async insertUserOperations(
    dtos: Partial<UserOperation>[],
    entityManager?: EntityManager,
  ): Promise<UserOperation[]> {
    if (dtos.length === 0) return [];
    const repo = this.repo(entityManager);
    const entities = repo.create(dtos);
    return repo.save(entities);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Block } from '../entities/block.entity';

@Injectable()
export class BlockRepository {
  constructor(
    @InjectRepository(Block)
    private readonly blockRepo: Repository<Block>,
  ) {}

  // 트랜잭션 패턴: entityManager 가 있으면 그 트랜잭션 컨텍스트를, 없으면 독립 쿼리를 쓴다.
  private repo(entityManager?: EntityManager): Repository<Block> {
    return entityManager ? entityManager.getRepository(Block) : this.blockRepo;
  }

  async findOneByHeight(height: number, entityManager?: EntityManager): Promise<Block | null> {
    return this.repo(entityManager).findOne({ where: { height } });
  }

  async findOneByHash(hash: string, entityManager?: EntityManager): Promise<Block | null> {
    return this.repo(entityManager).findOne({ where: { hash } });
  }

  async countTotal(entityManager?: EntityManager): Promise<number> {
    return this.repo(entityManager).count();
  }

  async findLatest(limit = 10, entityManager?: EntityManager): Promise<Block[]> {
    return this.repo(entityManager).find({
      order: { height: 'DESC' },
      take: limit,
    });
  }

  async findPaginated(
    page = 1,
    limit = 25,
    entityManager?: EntityManager,
  ): Promise<{ items: Block[]; total: number; page: number; totalPages: number }> {
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit));
    const [items, total] = await this.repo(entityManager).findAndCount({
      order: { height: 'DESC' },
      skip: (validPage - 1) * validLimit,
      take: validLimit,
    });

    return {
      items,
      total,
      page: validPage,
      totalPages: Math.ceil(total / validLimit) || 1,
    };
  }

  async getLatestHeight(entityManager?: EntityManager): Promise<number> {
    const blocks = await this.repo(entityManager).find({
      order: { height: 'DESC' },
      take: 1,
    });
    return blocks.length > 0 ? Number(blocks[0].height) : 0;
  }

  async countByProposer(entityManager?: EntityManager): Promise<Array<{ proposer: string; count: number }>> {
    const raw = await this.repo(entityManager)
      .createQueryBuilder('block')
      .select('LOWER(block.proposer)', 'proposer')
      .addSelect('COUNT(*)', 'count')
      .groupBy('LOWER(block.proposer)')
      .getRawMany();
    return raw.map((r) => ({ proposer: r.proposer, count: parseInt(r.count, 10) || 0 }));
  }

  async insertBlock(dto: Partial<Block>, entityManager?: EntityManager): Promise<Block> {
    const repo = this.repo(entityManager);
    const block = repo.create(dto);
    return repo.save(block);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';

@Injectable()
export class TransactionRepository {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  private repo(entityManager?: EntityManager): Repository<Transaction> {
    return entityManager ? entityManager.getRepository(Transaction) : this.txRepo;
  }

  async findOneByHash(hash: string, entityManager?: EntityManager): Promise<Transaction | null> {
    return this.repo(entityManager).findOne({ where: { hash } });
  }

  async findByBlockHeight(blockHeight: number, entityManager?: EntityManager): Promise<Transaction[]> {
    return this.repo(entityManager).find({ where: { blockHeight }, order: { nonce: 'ASC' } });
  }

  async countTotal(entityManager?: EntityManager): Promise<number> {
    return this.repo(entityManager).count();
  }

  async findLatest(limit = 10, entityManager?: EntityManager): Promise<Transaction[]> {
    return this.repo(entityManager).find({
      order: { blockHeight: 'DESC', nonce: 'DESC' },
      take: limit,
    });
  }

  async findPaginated(
    page = 1,
    limit = 25,
    entityManager?: EntityManager,
  ): Promise<{ items: Transaction[]; total: number; page: number; totalPages: number }> {
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit));
    const [items, total] = await this.repo(entityManager).findAndCount({
      order: { blockHeight: 'DESC', nonce: 'DESC' },
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

  async findByAddress(address: string, limit = 50, entityManager?: EntityManager): Promise<Transaction[]> {
    if (!address) return [];
    const fullAddr = address.toLowerCase();

    return this.repo(entityManager)
      .createQueryBuilder('tx')
      .where('LOWER(tx.from) = :fullAddr OR LOWER(tx.to) = :fullAddr', { fullAddr })
      .orderBy('tx.blockHeight', 'DESC')
      .take(limit)
      .getMany();
  }

  async countByAddress(address: string, entityManager?: EntityManager): Promise<number> {
    if (!address) return 0;
    const fullAddr = address.toLowerCase();

    return this.repo(entityManager)
      .createQueryBuilder('tx')
      .where('LOWER(tx.from) = :fullAddr OR LOWER(tx.to) = :fullAddr', { fullAddr })
      .getCount();
  }

  async findCandidateInteractions(address: string, limit = 100, entityManager?: EntityManager): Promise<Transaction[]> {
    if (!address) return [];
    const cleanAddr = address.toLowerCase().replace(/^0x/, '');
    const fullAddr = address.toLowerCase();

    return this.repo(entityManager)
      .createQueryBuilder('tx')
      .where('LOWER(tx.from) = :fullAddr OR LOWER(tx.to) = :fullAddr', { fullAddr })
      .orWhere('LOWER(tx.data) LIKE :addrPattern', { addrPattern: `%${cleanAddr}%` })
      .orderBy('tx.blockHeight', 'DESC')
      .take(limit)
      .getMany();
  }

  async findLatestFaucetClaim(recipient: string, entityManager?: EntityManager): Promise<Transaction | null> {
    const cleanAddr = recipient.toLowerCase().replace(/^0x/, '');
    const faucetAddr = (process.env.FAUCET_ADDRESS || '0x4c219b464eb113f4d3c7ce0a438fb2e99f6b07b6').toLowerCase();

    return this.repo(entityManager)
      .createQueryBuilder('tx')
      .where('LOWER(tx.to) = :faucetAddr', { faucetAddr })
      .andWhere(
        '(LOWER(tx.from) = :recipient OR (LOWER(tx.data) LIKE :claimPrefix AND LOWER(tx.data) LIKE :addrSuffix) OR (LOWER(tx.data) LIKE :reqPrefix AND LOWER(tx.data) LIKE :addrPattern))',
        {
          recipient: recipient.toLowerCase(),
          claimPrefix: '0x4e71d92d%',
          addrSuffix: `%${cleanAddr}`,
          reqPrefix: '0x27c78c42%',
          addrPattern: `%${cleanAddr}%`,
        },
      )
      .andWhere('tx.status = :status', { status: 'SUCCESS' })
      .orderBy('tx.createdAt', 'DESC')
      .getOne();
  }

  async insertTransactions(dtos: Partial<Transaction>[], entityManager?: EntityManager): Promise<Transaction[]> {
    if (dtos.length === 0) return [];
    const repo = this.repo(entityManager);
    const entities = repo.create(dtos);
    return repo.save(entities);
  }

  async findMatchingAddresses(
    prefix: string,
    limit = 5,
    entityManager?: EntityManager,
  ): Promise<Array<{ address: string; txCount: number }>> {
    if (!prefix || prefix.length < 3) return [];
    const cleanPrefix = prefix.toLowerCase().replace(/%/g, '');
    const pattern = `${cleanPrefix}%`;

    const raw = await this.repo(entityManager).query(
      `
      SELECT addr as address, COUNT(*)::int as "txCount" FROM (
        SELECT LOWER("from") as addr FROM transactions WHERE LOWER("from") LIKE $1
        UNION ALL
        SELECT LOWER("to") as addr FROM transactions WHERE LOWER("to") LIKE $1
      ) sub
      WHERE addr IS NOT NULL AND addr != '' AND addr != '0x' AND addr != '0x0'
      GROUP BY addr
      ORDER BY "txCount" DESC
      LIMIT $2
      `,
      [pattern, limit],
    );

    return raw.map((r: any) => ({
      address: r.address,
      txCount: Number(r.txCount || 0),
    }));
  }

  async findMatchingTxHashes(
    prefix: string,
    limit = 5,
    entityManager?: EntityManager,
  ): Promise<Transaction[]> {
    if (!prefix || prefix.length < 4) return [];
    const cleanPrefix = prefix.toLowerCase().replace(/%/g, '');
    const pattern = `${cleanPrefix}%`;

    return this.repo(entityManager)
      .createQueryBuilder('tx')
      .where('LOWER(tx.hash) LIKE :pattern', { pattern })
      .orderBy('tx.blockHeight', 'DESC')
      .take(limit)
      .getMany();
  }
}


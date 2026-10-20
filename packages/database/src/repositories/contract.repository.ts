import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Contract } from '../entities/contract.entity';

@Injectable()
export class ContractRepository {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>,
  ) {}

  private repo(entityManager?: EntityManager): Repository<Contract> {
    return entityManager ? entityManager.getRepository(Contract) : this.contractRepo;
  }

  async findOneByAddress(address: string, entityManager?: EntityManager): Promise<Contract | null> {
    if (!address) return null;
    return this.repo(entityManager)
      .createQueryBuilder('contract')
      .where('LOWER(contract.address) = :address', { address: address.toLowerCase() })
      .getOne();
  }

  async findByAddresses(addresses: string[], entityManager?: EntityManager): Promise<Contract[]> {
    if (!addresses || addresses.length === 0) return [];
    const lowerAddrs = addresses.map((a) => a.toLowerCase()).filter(Boolean);
    if (lowerAddrs.length === 0) return [];
    return this.repo(entityManager)
      .createQueryBuilder('contract')
      .where('LOWER(contract.address) IN (:...addresses)', { addresses: lowerAddrs })
      .getMany();
  }

  async createContract(dto: Partial<Contract>, entityManager?: EntityManager): Promise<Contract> {
    const repo = this.repo(entityManager);
    const contract = repo.create(dto);
    return repo.save(contract);
  }

  async updateVerifiedStatus(
    address: string,
    data: {
      name: string;
      sourceCode: string;
      compilerVersion: string;
      abi: unknown;
    },
    entityManager?: EntityManager,
  ): Promise<void> {
    await this.repo(entityManager).update(
      { address },
      {
        name: data.name,
        sourceCode: data.sourceCode,
        compilerVersion: data.compilerVersion,
        abi: data.abi,
        isVerified: true,
        verifiedAt: new Date(),
      },
    );
  }

  async updateProxyStatus(
    address: string,
    data: {
      isProxy: boolean;
      proxyType?: string | null;
      implementationAddress?: string | null;
    },
    entityManager?: EntityManager,
  ): Promise<void> {
    await this.repo(entityManager)
      .createQueryBuilder()
      .update(Contract)
      .set({
        isProxy: data.isProxy,
        proxyType: data.proxyType || 'ERC-1967',
        implementationAddress: data.implementationAddress ? data.implementationAddress.toLowerCase() : null,
      })
      .where('LOWER(address) = :address', { address: address.toLowerCase() })
      .execute();
  }

  async findByImplementationAddress(
    implementationAddress: string,
    entityManager?: EntityManager,
  ): Promise<Contract[]> {
    if (!implementationAddress) return [];
    return this.repo(entityManager)
      .createQueryBuilder('contract')
      .where('LOWER(contract.implementationAddress) = :impl', { impl: implementationAddress.toLowerCase() })
      .getMany();
  }

  async findLatestVerified(limit = 10, entityManager?: EntityManager): Promise<Contract[]> {
    return this.repo(entityManager).find({
      where: { isVerified: true },
      order: { verifiedAt: 'DESC' },
      take: limit,
    });
  }

  async searchContracts(
    query: string,
    limit = 8,
    entityManager?: EntityManager,
  ): Promise<Contract[]> {
    if (!query) return [];
    const clean = query.toLowerCase().replace(/%/g, '');
    const pattern = `%${clean}%`;
    const prefix = `${clean}%`;

    return this.repo(entityManager)
      .createQueryBuilder('contract')
      .where('LOWER(contract.name) LIKE :pattern', { pattern })
      .orWhere('LOWER(contract.address) LIKE :prefix', { prefix })
      .orderBy('contract.isVerified', 'DESC')
      .addOrderBy('contract.verifiedAt', 'DESC')
      .take(limit)
      .getMany();
  }
}



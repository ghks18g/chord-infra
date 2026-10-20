import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ContractVerification } from '../entities/contract-verification.entity';

@Injectable()
export class ContractVerificationRepository {
  constructor(
    @InjectRepository(ContractVerification)
    private readonly verificationRepo: Repository<ContractVerification>,
  ) {}

  private repo(entityManager?: EntityManager): Repository<ContractVerification> {
    return entityManager ? entityManager.getRepository(ContractVerification) : this.verificationRepo;
  }

  async createLog(dto: Partial<ContractVerification>, entityManager?: EntityManager): Promise<ContractVerification> {
    const repo = this.repo(entityManager);
    const log = repo.create(dto);
    return repo.save(log);
  }

  async findRecentByContract(contractAddress: string, entityManager?: EntityManager): Promise<ContractVerification[]> {
    return this.repo(entityManager).find({
      where: { contractAddress },
      order: { createdAt: 'DESC' },
      take: 5,
    });
  }
}

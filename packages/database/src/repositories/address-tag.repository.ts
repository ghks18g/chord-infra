import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AddressTag } from '../entities/address-tag.entity';

@Injectable()
export class AddressTagRepository {
  constructor(
    @InjectRepository(AddressTag)
    private readonly tagRepo: Repository<AddressTag>,
  ) {}

  private repo(entityManager?: EntityManager): Repository<AddressTag> {
    return entityManager ? entityManager.getRepository(AddressTag) : this.tagRepo;
  }

  async findOneByAddress(address: string, entityManager?: EntityManager): Promise<AddressTag | null> {
    if (!address) return null;
    return this.repo(entityManager).findOne({
      where: { address: address.toLowerCase() },
    });
  }

  async findAll(entityManager?: EntityManager): Promise<AddressTag[]> {
    return this.repo(entityManager).find({
      order: { category: 'ASC', nameTag: 'ASC' },
    });
  }

  async upsertTag(tag: Partial<AddressTag>, entityManager?: EntityManager): Promise<AddressTag> {
    const repo = this.repo(entityManager);
    const lowerAddr = (tag.address || '').toLowerCase();
    const existing = await repo.findOne({ where: { address: lowerAddr } });

    if (existing) {
      existing.nameTag = tag.nameTag || existing.nameTag;
      existing.category = tag.category || existing.category;
      existing.description = tag.description !== undefined ? tag.description : existing.description;
      existing.source = tag.source || existing.source;
      existing.isOfficial = tag.isOfficial !== undefined ? tag.isOfficial : existing.isOfficial;
      return repo.save(existing);
    }

    const created = repo.create({
      ...tag,
      address: lowerAddr,
    });
    return repo.save(created);
  }

  async bulkUpsert(tags: Partial<AddressTag>[], entityManager?: EntityManager): Promise<void> {
    for (const tag of tags) {
      if (tag.address && tag.nameTag) {
        await this.upsertTag(tag, entityManager);
      }
    }
  }
}

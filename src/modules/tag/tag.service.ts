import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { TagEntity } from './tag.entity.js';
import { CreateTagDto, QueryTagDto } from './tag.dto.js';

/**
 * 标签服务
 * 提供标签 CRUD、热门标签查询和使用计数
 */
@Injectable()
export class TagService {
  constructor(
    @InjectRepository(TagEntity)
    private readonly tagRepository: Repository<TagEntity>,
  ) {}

  /**
   * 创建标签
   * @param dto 创建参数
   * @param userId 创建者 ID
   */
  async create(dto: CreateTagDto, userId: string): Promise<TagEntity> {
    // 检查标签名是否已存在
    const existing = await this.tagRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`标签"${dto.name}"已存在`);
    }

    const tag = this.tagRepository.create({
      name: dto.name,
      type: dto.type || 'event',
      source: 'user',
      createdBy: userId,
    });

    return this.tagRepository.save(tag);
  }

  /**
   * 查询标签列表
   * 支持按类型筛选、关键词搜索和分页
   */
  async findAll(
    query: QueryTagDto,
  ): Promise<{ items: TagEntity[]; total: number }> {
    const { type, keyword, page = 1, limit = 20 } = query;

    const where: Record<string, unknown> = {};
    if (type) {
      where.type = type;
    }
    if (keyword) {
      where.name = Like(`%${keyword}%`);
    }

    const [items, total] = await this.tagRepository.findAndCount({
      where,
      order: { usageCount: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total };
  }

  /**
   * 查询热门标签
   * 按使用次数降序排列
   * @param limit 返回数量，默认 20
   */
  async findPopular(limit = 20): Promise<TagEntity[]> {
    return this.tagRepository.find({
      order: { usageCount: 'DESC' },
      take: limit,
    });
  }

  /**
   * 增加标签使用计数
   */
  async incrementUsage(tagId: string): Promise<void> {
    const result = await this.tagRepository.increment(
      { id: tagId },
      'usageCount',
      1,
    );
    if (result.affected === 0) {
      throw new NotFoundException(`标签不存在: ${tagId}`);
    }
  }

  /**
   * 查找或创建标签
   * 如果标签名已存在则返回现有标签，否则创建新标签
   * @param name 标签名
   * @param userId 创建者 ID
   */
  async findOrCreate(name: string, userId: string): Promise<TagEntity> {
    const existing = await this.tagRepository.findOne({ where: { name } });
    if (existing) {
      return existing;
    }

    const tag = this.tagRepository.create({
      name,
      type: 'event',
      source: 'user',
      createdBy: userId,
    });

    return this.tagRepository.save(tag);
  }
}

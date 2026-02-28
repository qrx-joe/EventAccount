import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEntity } from './event.entity.js';
import { CreateEventDto, UpdateEventDto, QueryEventDto } from './event.dto.js';

/**
 * 活动服务
 * 提供活动基础 CRUD，含创建者权限校验
 */
@Injectable()
export class EventService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
  ) {}

  /**
   * 创建活动
   * 新创建的活动默认为 draft 状态
   */
  async create(dto: CreateEventDto, creatorId: string): Promise<EventEntity> {
    const { tagIds, ...eventData } = dto;

    const event = this.eventRepository.create({
      ...eventData,
      creatorId,
      status: 'draft',
      auditStatus: 'pending',
    });

    // 关联标签（如果有）
    if (tagIds && tagIds.length > 0) {
      event.tags = tagIds.map((id) => ({ id }) as EventEntity['tags'][0]);
    }

    return this.eventRepository.save(event);
  }

  /**
   * 根据 ID 查询活动详情
   * 加载创建者、分类、标签关联
   */
  async findById(id: string): Promise<EventEntity> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['creator', 'category', 'tags', 'tickets'],
    });

    if (!event) {
      throw new NotFoundException('活动不存在');
    }

    return event;
  }

  /**
   * 更新活动
   * 仅创建者可更新，且只能更新 draft 状态的活动
   */
  async update(
    id: string,
    dto: UpdateEventDto,
    userId: string,
  ): Promise<EventEntity> {
    const event = await this.findById(id);
    this.assertCreator(event, userId);

    const { tagIds, ...updateData } = dto;

    // 更新基本字段
    Object.assign(event, updateData);

    // 更新标签关联（全量替换）
    if (tagIds !== undefined) {
      event.tags = tagIds.map(
        (tagId) => ({ id: tagId }) as EventEntity['tags'][0],
      );
    }

    return this.eventRepository.save(event);
  }

  /**
   * 删除活动
   * 仅创建者可删除
   */
  async delete(id: string, userId: string): Promise<void> {
    const event = await this.findById(id);
    this.assertCreator(event, userId);

    await this.eventRepository.remove(event);
  }

  /**
   * 查询活动列表
   * 支持状态筛选、分类筛选、关键词搜索和分页
   */
  async findAll(
    query: QueryEventDto,
  ): Promise<{ items: EventEntity[]; total: number }> {
    const { status, categoryId, keyword, page = 1, limit = 20 } = query;

    const qb = this.eventRepository
      .createQueryBuilder('event')
      .leftJoin('event.creator', 'creator')
      .addSelect([
        'creator.id',
        'creator.nickname',
        'creator.avatar',
        'creator.phone',
      ])
      .leftJoinAndSelect('event.category', 'category')
      .leftJoinAndSelect('event.tags', 'tags');

    if (status) {
      qb.andWhere('event.status = :status', { status });
    }

    if (categoryId) {
      qb.andWhere('event.categoryId = :categoryId', { categoryId });
    }

    if (keyword) {
      qb.andWhere('event.title LIKE :keyword', {
        keyword: `%${keyword}%`,
      });
    }

    qb.orderBy('event.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /**
   * 校验当前用户是否为活动创建者
   * @throws ForbiddenException 非创建者时抛出
   */
  private assertCreator(event: EventEntity, userId: string): void {
    if (event.creatorId !== userId) {
      throw new ForbiddenException('无权操作此活动');
    }
  }
}

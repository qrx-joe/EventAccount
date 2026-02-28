import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEntity } from './event.entity.js';
import { EventTicketEntity } from './event-ticket.entity.js';
import { CreateEventDto, UpdateEventDto, QueryEventDto } from './event.dto.js';
import { CreateTicketDto, UpdateTicketDto } from './ticket.dto.js';

/**
 * 活动服务
 * 提供活动基础 CRUD，含创建者权限校验
 */
@Injectable()
export class EventService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(EventTicketEntity)
    private readonly ticketRepository: Repository<EventTicketEntity>,
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
   * 发布活动
   * 仅 draft 状态可发布，发布后状态变为 published
   */
  async publish(id: string, userId: string): Promise<EventEntity> {
    const event = await this.findById(id);
    this.assertCreator(event, userId);

    if (event.status !== 'draft') {
      throw new BadRequestException('只有草稿状态的活动可以发布');
    }

    event.status = 'published';
    event.publishedAt = new Date();

    return this.eventRepository.save(event);
  }

  /**
   * 取消活动
   * 仅 published 状态可取消，取消后状态变为 cancelled
   */
  async cancel(id: string, userId: string): Promise<EventEntity> {
    const event = await this.findById(id);
    this.assertCreator(event, userId);

    if (event.status !== 'published') {
      throw new BadRequestException('只有已发布的活动可以取消');
    }

    event.status = 'cancelled';

    return this.eventRepository.save(event);
  }

  /**
   * 复制活动
   * 基于现有活动创建新的 draft 副本（不复制门票、协办人、标签关联）
   */
  async copy(id: string, userId: string): Promise<EventEntity> {
    const event = await this.findById(id);
    this.assertCreator(event, userId);

    const copied = this.eventRepository.create({
      creatorId: userId,
      title: `${event.title}（副本）`,
      description: event.description,
      coverImage: event.coverImage,
      startTime: event.startTime,
      endTime: event.endTime,
      timezone: event.timezone,
      locationType: event.locationType,
      locationName: event.locationName,
      locationAddress: event.locationAddress,
      latitude: event.latitude,
      longitude: event.longitude,
      onlineLink: event.onlineLink,
      visibility: event.visibility,
      requireApproval: event.requireApproval,
      capacity: event.capacity,
      categoryId: event.categoryId,
      theme: event.theme,
      status: 'draft',
      auditStatus: 'pending',
    });

    return this.eventRepository.save(copied);
  }

  // ==================== 门票管理 ====================

  /**
   * 获取活动的所有门票
   * 按 sortOrder 升序排列
   */
  async getTickets(eventId: string): Promise<EventTicketEntity[]> {
    // 先验证活动存在
    await this.findById(eventId);

    return this.ticketRepository.find({
      where: { eventId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * 创建门票
   * 仅创建者可操作，校验售卖时间窗口
   */
  async createTicket(
    eventId: string,
    dto: CreateTicketDto,
    userId: string,
  ): Promise<EventTicketEntity> {
    const event = await this.findById(eventId);
    this.assertCreator(event, userId);

    // 校验售卖时间窗口
    this.validateSaleTimeWindow(dto.saleStartTime, dto.saleEndTime);

    const ticket = this.ticketRepository.create({
      eventId,
      ...dto,
    });

    return this.ticketRepository.save(ticket);
  }

  /**
   * 更新门票
   * 仅创建者可操作，校验数量和售卖时间
   */
  async updateTicket(
    eventId: string,
    ticketId: string,
    dto: UpdateTicketDto,
    userId: string,
  ): Promise<EventTicketEntity> {
    const event = await this.findById(eventId);
    this.assertCreator(event, userId);

    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId, eventId },
    });
    if (!ticket) {
      throw new NotFoundException('门票不存在');
    }

    // 校验数量：新数量不能小于已售数量
    if (
      dto.quantity !== undefined &&
      dto.quantity > 0 &&
      dto.quantity < ticket.soldCount
    ) {
      throw new BadRequestException(
        `数量不能小于已售数量（已售 ${ticket.soldCount}）`,
      );
    }

    // 校验售卖时间窗口（合并现有值和更新值）
    const startTime =
      dto.saleStartTime ?? (ticket.saleStartTime?.toISOString() || undefined);
    const endTime =
      dto.saleEndTime ?? (ticket.saleEndTime?.toISOString() || undefined);
    this.validateSaleTimeWindow(startTime, endTime);

    Object.assign(ticket, dto);
    return this.ticketRepository.save(ticket);
  }

  /**
   * 删除门票
   * 仅创建者可操作，已有售出记录时不可删除
   */
  async deleteTicket(
    eventId: string,
    ticketId: string,
    userId: string,
  ): Promise<void> {
    const event = await this.findById(eventId);
    this.assertCreator(event, userId);

    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId, eventId },
    });
    if (!ticket) {
      throw new NotFoundException('门票不存在');
    }

    if (ticket.soldCount > 0) {
      throw new BadRequestException(
        `该门票已售出 ${ticket.soldCount} 张，无法删除`,
      );
    }

    await this.ticketRepository.remove(ticket);
  }

  // ==================== 私有方法 ====================

  /**
   * 校验当前用户是否为活动创建者
   * @throws ForbiddenException 非创建者时抛出
   */
  private assertCreator(event: EventEntity, userId: string): void {
    if (event.creatorId !== userId) {
      throw new ForbiddenException('无权操作此活动');
    }
  }

  /**
   * 校验售卖时间窗口
   * 开售时间必须早于停售时间
   */
  private validateSaleTimeWindow(
    saleStartTime?: string,
    saleEndTime?: string,
  ): void {
    if (saleStartTime && saleEndTime) {
      const start = new Date(saleStartTime);
      const end = new Date(saleEndTime);
      if (start >= end) {
        throw new BadRequestException('开售时间必须早于停售时间');
      }
    }
  }
}

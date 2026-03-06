import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as QRCode from 'qrcode';
import { EventEntity } from './event.entity.js';
import { EventTicketEntity } from './event-ticket.entity.js';
import {
  CreateEventDto,
  UpdateEventDto,
  QueryEventDto,
  MyEventsQueryDto,
} from './event.dto.js';
import { CreateTicketDto, UpdateTicketDto } from './ticket.dto.js';
import { EventCoHostEntity } from './event-co-host.entity.js';
import { CommunityStatus } from '../community/community.dto.js';
import { UserEntity } from '../user/user.entity.js';
import { CommunityEntity } from '../community/community.entity.js';

/**
 * 活动服务
 * 提供活动基础 CRUD、我的活动列表、分享/海报/二维码生成，含创建者权限校验
 */
@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(EventTicketEntity)
    private readonly ticketRepository: Repository<EventTicketEntity>,
    @InjectRepository(EventCoHostEntity)
    private readonly eventCoHostRepository: Repository<EventCoHostEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(CommunityEntity)
    private readonly communityRepository: Repository<CommunityEntity>,
  ) {}

  /**
   * 创建活动
   * 新创建的活动默认为 draft 状态
   */
  async create(dto: CreateEventDto, creatorId: string): Promise<EventEntity> {
    const { tagIds, ...eventData } = dto;

    // 如果指定了社区，检查社区状态
    if (eventData.communityId) {
      const community = await this.communityRepository.findOne({
        where: { id: eventData.communityId },
      });
      if (!community) {
        throw new NotFoundException('指定的社区不存在');
      }
      if (community.status === CommunityStatus.INACTIVE) {
        throw new ForbiddenException('该社区已被禁用，无法创建活动');
      }
    }

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
      relations: ['creator', 'category', 'tags', 'tickets', 'coHosts'],
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

  // ==================== 我的活动列表 ====================

  /**
   * 获取用户创建的活动列表
   * 支持状态筛选和分页
   */
  async getMyCreatedEvents(
    userId: string,
    query: MyEventsQueryDto,
  ): Promise<{ items: EventEntity[]; total: number }> {
    const { status, page = 1, limit = 20 } = query;

    const qb = this.eventRepository
      .createQueryBuilder('event')
      .leftJoin('event.creator', 'creator')
      .addSelect(['creator.id', 'creator.nickname', 'creator.avatar'])
      .leftJoinAndSelect('event.category', 'category')
      .leftJoinAndSelect('event.tags', 'tags')
      .where('event.creatorId = :userId', { userId });

    if (status) {
      qb.andWhere('event.status = :status', { status });
    }

    qb.orderBy('event.startTime', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /**
   * 获取用户报名的活动列表
   * 注意：依赖 Registration 模块（Task 14），当前返回空列表
   */
  getMyRegisteredEvents(
    userId: string,
    query: MyEventsQueryDto,
  ): { items: EventEntity[]; total: number } {
    // TODO: Task 14 实现报名模块后，通过 registration 表关联查询
    this.logger.warn(
      `getMyRegisteredEvents: Registration 模块尚未实现，用户 ${userId} 查询返回空列表`,
    );
    void query; // 避免未使用参数警告
    return { items: [], total: 0 };
  }

  // ==================== 分享与二维码 ====================

  /**
   * 生成活动分享链接
   * 创建者或协办人可生成
   */
  async generateShareLink(
    eventId: string,
    userId: string,
  ): Promise<{ shareUrl: string }> {
    const event = await this.findById(eventId);
    this.assertCreatorOrCoHost(event, userId);

    // 构建分享链接，指向前端活动详情页
    const baseUrl = this.frontendBaseUrl;
    const shareUrl = `${baseUrl}/events/${eventId}`;

    return { shareUrl };
  }

  /**
   * 生成签到二维码
   * 创建者或协办人可生成，二维码内容为签到 URL
   */
  async generateCheckInQrcode(
    eventId: string,
    userId: string,
  ): Promise<{ qrcodeDataUrl: string; checkInUrl: string }> {
    const event = await this.findById(eventId);
    this.assertCreatorOrCoHost(event, userId);

    // 签到链接指向前端签到页面
    const baseUrl = this.frontendBaseUrl;
    const checkInUrl = `${baseUrl}/events/${eventId}/check-in`;

    // 生成二维码 Data URL（base64 PNG）
    const qrcodeDataUrl = await QRCode.toDataURL(checkInUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    this.logger.log(`生成签到二维码：活动 ${eventId}`);
    return { qrcodeDataUrl, checkInUrl };
  }

  /**
   * 生成邀请海报
   * 创建者或协办人可生成，包含活动信息和二维码
   * 返回 base64 编码的海报图片（SVG 文本格式，供前端渲染）
   */
  async generateInvitePoster(
    eventId: string,
    userId: string,
  ): Promise<{
    qrcodeDataUrl: string;
    shareUrl: string;
    eventInfo: {
      title: string;
      startTime: Date;
      endTime: Date;
      locationName: string | null;
      coverImage: string | null;
    };
  }> {
    const event = await this.findById(eventId);
    this.assertCreatorOrCoHost(event, userId);

    // 生成分享链接和二维码
    const baseUrl = this.frontendBaseUrl;
    const shareUrl = `${baseUrl}/events/${eventId}`;

    const qrcodeDataUrl = await QRCode.toDataURL(shareUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    this.logger.log(`生成邀请海报数据：活动 ${eventId}`);

    // 返回海报所需数据，由前端负责渲染
    return {
      qrcodeDataUrl,
      shareUrl,
      eventInfo: {
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        locationName: event.locationName,
        coverImage: event.coverImage,
      },
    };
  }

  // ==================== 协办人管理 ====================

  /**
   * 获取活动协办人列表
   * 创建者或协办人可见
   */
  async getCoHosts(eventId: string, userId: string): Promise<UserEntity[]> {
    const event = await this.findById(eventId);
    this.assertCreatorOrCoHost(event, userId);

    const coHosts = await this.eventCoHostRepository.find({
      where: { eventId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    return coHosts.map((item) => item.user);
  }

  /**
   * 添加协办人
   * 仅活动创建者可添加
   */
  async addCoHost(
    eventId: string,
    targetUserId: string,
    userId: string,
  ): Promise<EventCoHostEntity> {
    const event = await this.findById(eventId);
    this.assertCreator(event, userId);

    if (event.creatorId === targetUserId) {
      throw new BadRequestException('创建者无需重复添加为协办人');
    }

    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException('目标用户不存在');
    }

    const exists = await this.eventCoHostRepository.findOne({
      where: { eventId, userId: targetUserId },
    });
    if (exists) {
      throw new BadRequestException('该用户已是协办人');
    }

    const coHost = this.eventCoHostRepository.create({
      eventId,
      userId: targetUserId,
    });
    const saved = await this.eventCoHostRepository.save(coHost);
    saved.user = targetUser;
    return saved;
  }

  /**
   * 移除协办人
   * 仅活动创建者可移除
   */
  async removeCoHost(
    eventId: string,
    targetUserId: string,
    userId: string,
  ): Promise<void> {
    const event = await this.findById(eventId);
    this.assertCreator(event, userId);

    const coHost = await this.eventCoHostRepository.findOne({
      where: { eventId, userId: targetUserId },
    });
    if (!coHost) {
      throw new NotFoundException('协办人不存在');
    }

    await this.eventCoHostRepository.remove(coHost);
  }

  // ==================== 门票管理 ====================

  /**
   * 获取活动的所有门票列表
   * 按排序权重和创建时间排序
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

  /** 获取前端基础 URL，用于生成分享链接和二维码 */
  private get frontendBaseUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:5173';
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

  /**
   * 校验当前用户是否为创建者或协办人
   */
  private assertCreatorOrCoHost(event: EventEntity, userId: string): void {
    if (event.creatorId === userId) {
      return;
    }

    const isCoHost = event.coHosts?.some((host) => host.userId === userId);
    if (!isCoHost) {
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

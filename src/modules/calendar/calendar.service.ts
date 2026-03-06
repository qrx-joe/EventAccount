import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarEntity } from './calendar.entity.js';
import { CalendarSubscriptionEntity } from './calendar-subscription.entity.js';
import { CommunityEntity } from '../community/community.entity.js';
import {
  CreateCalendarDto,
  UpdateCalendarDto,
  QueryCalendarDto,
  SubscribeCalendarDto,
  CalendarStatus,
} from './calendar.dto.js';

/**
 * 日历服务
 * 提供日历 CRUD、订阅管理等功能
 */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    @InjectRepository(CalendarEntity)
    private readonly calendarRepo: Repository<CalendarEntity>,
    @InjectRepository(CalendarSubscriptionEntity)
    private readonly subscriptionRepo: Repository<CalendarSubscriptionEntity>,
    @InjectRepository(CommunityEntity)
    private readonly communityRepo: Repository<CommunityEntity>,
  ) {}

  /**
   * 创建日历
   * 每个社区只能有一个日历
   */
  async create(dto: CreateCalendarDto, creatorId: string): Promise<CalendarEntity> {
    // 检查社区是否存在
    const community = await this.communityRepo.findOne({
      where: { id: dto.communityId },
    });
    if (!community) {
      throw new NotFoundException('社区不存在');
    }

    // 检查是否是社区创建者或管理员
    if (community.creatorId !== creatorId) {
      throw new ForbiddenException('只有社区创建者可以创建日历');
    }

    // 检查社区是否已有日历
    const existingCalendar = await this.calendarRepo.findOne({
      where: { communityId: dto.communityId },
    });
    if (existingCalendar) {
      throw new BadRequestException('该社区已存在日历');
    }

    const calendar = new CalendarEntity();
    calendar.communityId = dto.communityId;
    calendar.creatorId = creatorId;
    calendar.name = dto.name;
    calendar.description = dto.description || null;
    calendar.themeColor = dto.themeColor || null;
    calendar.isPublic = dto.isPublic ?? true;
    calendar.status = CalendarStatus.ACTIVE;
    calendar.subscriberCount = 0;

    const saved = await this.calendarRepo.save(calendar);
    this.logger.log(`用户 ${creatorId} 为社区 ${dto.communityId} 创建日历`);
    return saved;
  }

  /**
   * 日历列表（分页 + 筛选）
   */
  async findAll(query: QueryCalendarDto, userId?: string): Promise<{ items: CalendarEntity[]; total: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.calendarRepo
      .createQueryBuilder('calendar')
      .leftJoinAndSelect('calendar.community', 'community')
      .where('calendar.status = :status', { status: CalendarStatus.ACTIVE });

    if (query.keyword) {
      qb.andWhere('calendar.name ILIKE :keyword', { keyword: `%${query.keyword}%` });
    }

    if (query.communityId) {
      qb.andWhere('calendar.communityId = :communityId', { communityId: query.communityId });
    }

    // 如果不是查询自己的日历，只显示公开的
    if (!query.communityId && userId) {
      qb.andWhere('calendar.isPublic = :isPublic', { isPublic: true });
    }

    qb.orderBy('calendar.subscriberCount', 'DESC')
      .addOrderBy('calendar.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /**
   * 获取我的日历（我创建的社区的日历）
   */
  async getMyCalendars(userId: string): Promise<CalendarEntity[]> {
    return this.calendarRepo
      .createQueryBuilder('calendar')
      .leftJoinAndSelect('calendar.community', 'community')
      .where('calendar.creatorId = :userId', { userId })
      .andWhere('calendar.status = :status', { status: CalendarStatus.ACTIVE })
      .orderBy('calendar.createdAt', 'DESC')
      .getMany();
  }

  /**
   * 获取我订阅的日历
   */
  async getMySubscribedCalendars(userId: string): Promise<CalendarSubscriptionEntity[]> {
    return this.subscriptionRepo
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.calendar', 'calendar')
      .leftJoinAndSelect('calendar.community', 'community')
      .where('sub.userId = :userId', { userId })
      .andWhere('calendar.status = :status', { status: CalendarStatus.ACTIVE })
      .orderBy('sub.createdAt', 'DESC')
      .getMany();
  }

  /**
   * 根据 ID 查询日历详情
   */
  async findById(id: string, userId?: string): Promise<CalendarEntity> {
    const calendar = await this.calendarRepo.findOne({
      where: { id },
      relations: ['community'],
    });

    if (!calendar) {
      throw new NotFoundException('日历不存在');
    }

    // 如果日历不是公开的，只有创建者可以查看
    if (!calendar.isPublic && calendar.creatorId !== userId) {
      throw new ForbiddenException('无权查看此日历');
    }

    return calendar;
  }

  /**
   * 根据社区 ID 查询日历
   */
  async findByCommunityId(communityId: string): Promise<CalendarEntity | null> {
    return this.calendarRepo.findOne({
      where: { communityId, status: CalendarStatus.ACTIVE },
      relations: ['community'],
    });
  }

  /**
   * 更新日历
   */
  async update(id: string, dto: UpdateCalendarDto, userId: string): Promise<CalendarEntity> {
    const calendar = await this.findById(id, userId);

    if (calendar.creatorId !== userId) {
      throw new ForbiddenException('只有创建者可以更新日历');
    }

    if (dto.name !== undefined) calendar.name = dto.name;
    if (dto.description !== undefined) calendar.description = dto.description;
    if (dto.themeColor !== undefined) calendar.themeColor = dto.themeColor;
    if (dto.isPublic !== undefined) calendar.isPublic = dto.isPublic;
    if (dto.status !== undefined) calendar.status = dto.status;

    const saved = await this.calendarRepo.save(calendar);
    this.logger.log(`用户 ${userId} 更新日历 ${id}`);
    return saved;
  }

  /**
   * 删除日历
   */
  async delete(id: string, userId: string): Promise<void> {
    const calendar = await this.findById(id, userId);

    if (calendar.creatorId !== userId) {
      throw new ForbiddenException('只有创建者可以删除日历');
    }

    await this.calendarRepo.remove(calendar);
    this.logger.log(`用户 ${userId} 删除日历 ${id}`);
  }

  /**
   * 订阅日历
   */
  async subscribe(dto: SubscribeCalendarDto, userId: string): Promise<CalendarSubscriptionEntity> {
    const calendar = await this.findById(dto.calendarId, userId);

    if (calendar.creatorId === userId) {
      throw new BadRequestException('不能订阅自己的日历');
    }

    // 检查是否已订阅
    const existing = await this.subscriptionRepo.findOne({
      where: { userId, calendarId: dto.calendarId },
    });
    if (existing) {
      throw new BadRequestException('已订阅该日历');
    }

    const subscription = new CalendarSubscriptionEntity();
    subscription.userId = userId;
    subscription.calendarId = dto.calendarId;
    subscription.receiveNotification = dto.receiveNotification ?? true;

    const saved = await this.subscriptionRepo.save(subscription);

    // 更新订阅人数
    calendar.subscriberCount += 1;
    await this.calendarRepo.save(calendar);

    this.logger.log(`用户 ${userId} 订阅日历 ${dto.calendarId}`);
    return saved;
  }

  /**
   * 取消订阅
   */
  async unsubscribe(calendarId: string, userId: string): Promise<void> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { userId, calendarId },
    });
    if (!subscription) {
      throw new NotFoundException('未订阅该日历');
    }

    await this.subscriptionRepo.remove(subscription);

    // 更新订阅人数
    const calendar = await this.calendarRepo.findOne({ where: { id: calendarId } });
    if (calendar && calendar.subscriberCount > 0) {
      calendar.subscriberCount -= 1;
      await this.calendarRepo.save(calendar);
    }

    this.logger.log(`用户 ${userId} 取消订阅日历 ${calendarId}`);
  }

  /**
   * 检查是否已订阅
   */
  async isSubscribed(calendarId: string, userId: string): Promise<boolean> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { userId, calendarId },
    });
    return !!subscription;
  }
}

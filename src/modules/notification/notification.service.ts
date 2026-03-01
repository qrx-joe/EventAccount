import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { NotificationEntity } from './notification.entity.js';
import { EventEntity } from '../event/event.entity.js';
import { RegistrationEntity } from '../registration/registration.entity.js';
import { EmailService } from './email.service.js';
import { QueryNotificationDto, BroadcastDto } from './notification.dto.js';

/**
 * 通知服务
 * 处理站内通知的创建、查询、标记已读和群发消息
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(RegistrationEntity)
    private readonly registrationRepository: Repository<RegistrationEntity>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * 创建站内通知
   * 供其他模块调用（报名成功、活动更新等场景）
   */
  async create(data: {
    userId: string;
    type: string;
    title: string;
    content: string;
    relatedType?: string;
    relatedId?: string;
  }): Promise<NotificationEntity> {
    const notification = this.notificationRepository.create({
      userId: data.userId,
      type: data.type,
      title: data.title,
      content: data.content,
      relatedType: data.relatedType || null,
      relatedId: data.relatedId || null,
    });
    const saved = await this.notificationRepository.save(notification);
    this.logger.log(
      `创建通知: ${data.type}, 用户: ${data.userId}, 标题: ${data.title}`,
    );
    return saved;
  }

  /**
   * 获取当前用户的通知列表
   * 支持类型和已读状态筛选，分页
   */
  async getNotifications(
    userId: string,
    query: QueryNotificationDto,
  ): Promise<{ items: NotificationEntity[]; total: number }> {
    const where: FindOptionsWhere<NotificationEntity> = { userId };
    if (query.type) {
      where.type = query.type;
    }
    if (query.isRead !== undefined) {
      where.isRead = query.isRead === 'true';
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.notificationRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total };
  }

  /**
   * 标记单条通知为已读
   * 仅通知所属用户可操作
   */
  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationEntity> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });
    if (!notification) {
      throw new NotFoundException('通知不存在');
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException('无权操作此通知');
    }

    notification.isRead = true;
    return this.notificationRepository.save(notification);
  }

  /**
   * 标记当前用户所有通知为已读
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
    this.logger.log(`标记所有通知为已读: 用户 ${userId}`);
  }

  /**
   * 获取未读通知数量
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * 群发消息
   * 仅活动创建者可操作，向所有 approved 状态的报名者发送通知
   * 支持站内通知和邮件两个渠道
   */
  async broadcast(
    eventId: string,
    userId: string,
    dto: BroadcastDto,
  ): Promise<{ notifiedCount: number }> {
    // 验证活动存在且操作者是创建者
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException('活动不存在');
    }
    if (event.creatorId !== userId) {
      throw new ForbiddenException('无权操作此活动');
    }

    // 获取所有已通过的报名者
    const registrations = await this.registrationRepository.find({
      where: { eventId, status: 'approved' },
      relations: ['user'],
    });

    let notifiedCount = 0;

    for (const reg of registrations) {
      // 站内通知
      if (dto.channels.includes('in_app')) {
        await this.create({
          userId: reg.userId,
          type: 'event_update',
          title: dto.title,
          content: dto.message,
          relatedType: 'event',
          relatedId: eventId,
        });
      }

      // 邮件通知
      if (dto.channels.includes('email') && reg.user?.email) {
        await this.emailService.sendBroadcastEmail(reg.user.email, {
          title: dto.title,
          message: dto.message,
          eventTitle: event.title,
        });
      }

      notifiedCount++;
    }

    this.logger.log(
      `群发消息: 活动 ${eventId}, 通知 ${notifiedCount} 人, 渠道: ${dto.channels.join(',')}`,
    );

    return { notifiedCount };
  }

  /**
   * 发送报名确认通知
   * 报名成功时由 RegistrationService 调用
   */
  async sendRegistrationConfirmation(
    userId: string,
    registrationId: string,
    eventTitle: string,
    userEmail?: string | null,
  ): Promise<void> {
    // 站内通知
    await this.create({
      userId,
      type: 'registration_confirm',
      title: '报名成功',
      content: `您已成功报名活动「${eventTitle}」`,
      relatedType: 'registration',
      relatedId: registrationId,
    });

    // 邮件通知（如果有邮箱）
    if (userEmail) {
      await this.emailService.sendRegistrationConfirmEmail(userEmail, {
        eventTitle,
        registrationId,
      });
    }
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RegistrationEntity } from './registration.entity.js';
import { EventRegistrationFormEntity } from './event-registration-form.entity.js';
import { EventEntity } from '../event/event.entity.js';
import { EventTicketEntity } from '../event/event-ticket.entity.js';
import { CreateRegistrationDto } from './registration.dto.js';
import { SetRegistrationFormDto } from './registration-form.dto.js';

/**
 * 报名服务
 * 处理活动报名、取消报名和报名问卷配置
 */
@Injectable()
export class RegistrationService {
  constructor(
    @InjectRepository(RegistrationEntity)
    private readonly registrationRepository: Repository<RegistrationEntity>,
    @InjectRepository(EventRegistrationFormEntity)
    private readonly formRepository: Repository<EventRegistrationFormEntity>,
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(EventTicketEntity)
    private readonly ticketRepository: Repository<EventTicketEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 报名活动
   * 检查活动状态、名额、重复报名、问卷必填字段
   * 名额满时自动加入候补名单
   */
  async register(
    eventId: string,
    userId: string,
    dto: CreateRegistrationDto,
  ): Promise<RegistrationEntity> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException('活动不存在');
    }

    // 检查活动状态：必须已发布
    if (event.status !== 'published') {
      throw new BadRequestException('活动未发布，无法报名');
    }

    // 检查是否重复报名（排除已取消的）
    const existing = await this.registrationRepository.findOne({
      where: { eventId, userId },
    });
    if (existing && existing.status !== 'cancelled') {
      throw new ConflictException('您已报名此活动');
    }

    // 校验门票
    let ticket: EventTicketEntity | null = null;
    if (dto.ticketId) {
      ticket = await this.ticketRepository.findOne({
        where: { id: dto.ticketId, eventId },
      });
      if (!ticket) {
        throw new NotFoundException('门票不存在');
      }
      if (ticket.status !== 'active') {
        throw new BadRequestException('该门票已停售');
      }
      // 检查门票名额
      if (ticket.quantity > 0 && ticket.soldCount >= ticket.quantity) {
        throw new BadRequestException('该门票已售罄');
      }
    }

    // 校验报名问卷必填字段
    await this.validateFormData(eventId, dto.formData);

    // 确定报名状态
    let status = 'pending';
    if (event.requireApproval) {
      // 需要审核，状态保持 pending
      status = 'pending';
    } else {
      // 不需要审核，直接通过
      status = 'approved';
    }

    // 检查活动总名额
    if (event.capacity > 0) {
      const approvedCount = await this.registrationRepository.count({
        where: { eventId, status: 'approved' },
      });
      if (approvedCount >= event.capacity) {
        // 名额已满，加入候补
        status = 'waitlisted';
      }
    }

    // 使用事务处理报名和门票计数
    return this.dataSource.transaction(async (manager) => {
      // 如果之前取消过，复用记录
      let registration: RegistrationEntity;
      if (existing && existing.status === 'cancelled') {
        existing.status = status;
        existing.ticketId = dto.ticketId || null;
        existing.email = dto.email || null;
        existing.formData = dto.formData || null;
        existing.checkInStatus = 'not_checked_in';
        existing.checkedInAt = null;
        registration = await manager.save(RegistrationEntity, existing);
      } else {
        registration = manager.create(RegistrationEntity, {
          eventId,
          userId,
          ticketId: dto.ticketId || null,
          status,
          email: dto.email || null,
          formData: dto.formData || null,
        });
        registration = await manager.save(RegistrationEntity, registration);
      }

      // 更新门票已售数量
      if (ticket && status === 'approved') {
        await manager.increment(
          EventTicketEntity,
          { id: ticket.id },
          'soldCount',
          1,
        );
      }

      return registration;
    });
  }

  /**
   * 取消报名
   * 仅允许报名者本人取消
   */
  async cancel(eventId: string, userId: string): Promise<RegistrationEntity> {
    const registration = await this.registrationRepository.findOne({
      where: { eventId, userId },
    });
    if (!registration) {
      throw new NotFoundException('报名记录不存在');
    }

    if (registration.status === 'cancelled') {
      throw new BadRequestException('报名已取消');
    }

    const previousStatus = registration.status;
    registration.status = 'cancelled';

    const result = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(RegistrationEntity, registration);

      // 如果之前是 approved 状态且有门票，减少已售数量
      if (previousStatus === 'approved' && registration.ticketId) {
        await manager.decrement(
          EventTicketEntity,
          { id: registration.ticketId },
          'soldCount',
          1,
        );
      }

      return saved;
    });

    // 取消后检查是否有候补可以递补
    if (previousStatus === 'approved') {
      await this.promoteWaitlisted(eventId);
    }

    return result;
  }

  /**
   * 获取报名问卷配置
   * 公开接口，报名前查看需要填写哪些字段
   */
  async getRegistrationForm(
    eventId: string,
  ): Promise<EventRegistrationFormEntity[]> {
    // 确认活动存在
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException('活动不存在');
    }

    return this.formRepository.find({
      where: { eventId },
      order: { sortOrder: 'ASC' },
    });
  }

  /**
   * 设置报名问卷配置
   * 批量覆盖：先删除旧字段，再插入新字段
   * 仅活动创建者可操作
   */
  async setRegistrationForm(
    eventId: string,
    userId: string,
    dto: SetRegistrationFormDto,
  ): Promise<EventRegistrationFormEntity[]> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException('活动不存在');
    }

    // 仅创建者可设置问卷
    if (event.creatorId !== userId) {
      throw new ForbiddenException('无权操作此活动');
    }

    // 事务中执行：删除旧字段 + 插入新字段
    return this.dataSource.transaction(async (manager) => {
      await manager.delete(EventRegistrationFormEntity, { eventId });

      const fields = dto.fields.map((field) =>
        manager.create(EventRegistrationFormEntity, {
          eventId,
          label: field.label,
          fieldType: field.fieldType,
          options: field.options || null,
          isRequired: field.isRequired,
          placeholder: field.placeholder || null,
          sortOrder: field.sortOrder,
        }),
      );

      return manager.save(EventRegistrationFormEntity, fields);
    });
  }

  /**
   * 校验报名问卷数据
   * 检查必填字段是否已提供
   */
  private async validateFormData(
    eventId: string,
    formData?: Record<string, unknown>,
  ): Promise<void> {
    const formFields = await this.formRepository.find({
      where: { eventId, isRequired: true },
    });

    if (formFields.length === 0) {
      return; // 没有必填字段，无需校验
    }

    if (!formData) {
      throw new BadRequestException(
        `请填写报名问卷：${formFields.map((f) => f.label).join('、')}`,
      );
    }

    const missingFields = formFields.filter((field) => {
      const value = formData[field.label];
      return value === undefined || value === null || value === '';
    });

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `以下必填字段未填写：${missingFields.map((f) => f.label).join('、')}`,
      );
    }
  }

  /**
   * 候补递补
   * 当有人取消报名时，按报名时间顺序递补候补名单中的用户
   */
  private async promoteWaitlisted(eventId: string): Promise<void> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event || event.capacity <= 0) return;

    const approvedCount = await this.registrationRepository.count({
      where: { eventId, status: 'approved' },
    });

    const availableSlots = event.capacity - approvedCount;
    if (availableSlots <= 0) return;

    // 按报名时间排序，取最早的候补
    const waitlisted = await this.registrationRepository.find({
      where: { eventId, status: 'waitlisted' },
      order: { createdAt: 'ASC' },
      take: availableSlots,
    });

    if (waitlisted.length > 0) {
      waitlisted.forEach((reg) => (reg.status = 'approved'));
      await this.registrationRepository.save(waitlisted);
    }
  }
}

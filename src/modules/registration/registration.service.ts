import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere } from 'typeorm';
import * as QRCode from 'qrcode';
import { RegistrationEntity } from './registration.entity.js';
import { EventRegistrationFormEntity } from './event-registration-form.entity.js';
import { EventEntity } from '../event/event.entity.js';
import { EventTicketEntity } from '../event/event-ticket.entity.js';
import {
  CreateRegistrationDto,
  QueryRegistrationDto,
} from './registration.dto.js';
import { SetRegistrationFormDto } from './registration-form.dto.js';
import { NotificationService } from '../notification/notification.service.js';

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
    private readonly notificationService: NotificationService,
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
    const registration = await this.dataSource.transaction(async (manager) => {
      // 如果之前取消过，复用记录
      let reg: RegistrationEntity;
      if (existing && existing.status === 'cancelled') {
        existing.status = status;
        existing.ticketId = dto.ticketId || null;
        existing.email = dto.email || null;
        existing.formData = dto.formData || null;
        existing.checkInStatus = 'not_checked_in';
        existing.checkedInAt = null;
        reg = await manager.save(RegistrationEntity, existing);
      } else {
        reg = manager.create(RegistrationEntity, {
          eventId,
          userId,
          ticketId: dto.ticketId || null,
          status,
          email: dto.email || null,
          formData: dto.formData || null,
        });
        reg = await manager.save(RegistrationEntity, reg);
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

      return reg;
    });

    // 报名成功后发送确认通知（事务外异步执行，不影响报名结果）
    if (status === 'approved') {
      this.notificationService
        .sendRegistrationConfirmation(
          userId,
          registration.id,
          event.title,
          dto.email,
        )
        .catch(() => {
          // 通知发送失败不影响报名结果
        });
    }

    return registration;
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
   * 获取我的报名记录
   * 查询当前用户在指定活动的报名状态
   */
  async getMyRegistration(
    eventId: string,
    userId: string,
  ): Promise<RegistrationEntity> {
    const registration = await this.registrationRepository.findOne({
      where: { eventId, userId },
      relations: ['ticket'],
    });
    if (!registration) {
      throw new NotFoundException('未找到报名记录');
    }
    return registration;
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
   * 审核通过报名
   * 仅活动创建者可操作，审核后自动处理门票计数
   */
  async approve(
    registrationId: string,
    userId: string,
  ): Promise<RegistrationEntity> {
    const registration = await this.registrationRepository.findOne({
      where: { id: registrationId },
    });
    if (!registration) {
      throw new NotFoundException('报名记录不存在');
    }

    // 仅 pending 或 waitlisted 可审核通过
    if (
      registration.status !== 'pending' &&
      registration.status !== 'waitlisted'
    ) {
      throw new BadRequestException('当前状态无法审核通过');
    }

    // 验证操作者是活动创建者
    const event = await this.eventRepository.findOne({
      where: { id: registration.eventId },
    });
    if (!event) {
      throw new NotFoundException('活动不存在');
    }
    if (event.creatorId !== userId) {
      throw new ForbiddenException('无权操作此活动');
    }

    return this.dataSource.transaction(async (manager) => {
      registration.status = 'approved';
      const saved = await manager.save(RegistrationEntity, registration);

      // 审核通过时更新门票已售数量
      if (registration.ticketId) {
        await manager.increment(
          EventTicketEntity,
          { id: registration.ticketId },
          'soldCount',
          1,
        );
      }

      return saved;
    });
  }

  /**
   * 审核拒绝报名
   * 仅活动创建者可操作
   */
  async reject(
    registrationId: string,
    userId: string,
  ): Promise<RegistrationEntity> {
    const registration = await this.registrationRepository.findOne({
      where: { id: registrationId },
    });
    if (!registration) {
      throw new NotFoundException('报名记录不存在');
    }

    if (
      registration.status !== 'pending' &&
      registration.status !== 'waitlisted'
    ) {
      throw new BadRequestException('当前状态无法拒绝');
    }

    const event = await this.eventRepository.findOne({
      where: { id: registration.eventId },
    });
    if (!event) {
      throw new NotFoundException('活动不存在');
    }
    if (event.creatorId !== userId) {
      throw new ForbiddenException('无权操作此活动');
    }

    registration.status = 'rejected';
    return this.registrationRepository.save(registration);
  }

  /**
   * 扫码签到
   * 通过 registrationId 签到，仅活动创建者可操作
   * 报名状态必须为 approved 才能签到
   */
  async checkIn(
    eventId: string,
    registrationId: string,
    userId: string,
  ): Promise<RegistrationEntity> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException('活动不存在');
    }
    if (event.creatorId !== userId) {
      throw new ForbiddenException('无权操作此活动');
    }

    const registration = await this.registrationRepository.findOne({
      where: { id: registrationId, eventId },
    });
    if (!registration) {
      throw new NotFoundException('报名记录不存在');
    }

    if (registration.status !== 'approved') {
      throw new BadRequestException('报名未通过审核，无法签到');
    }

    if (registration.checkInStatus === 'checked_in') {
      throw new ConflictException('已签到，请勿重复签到');
    }

    registration.checkInStatus = 'checked_in';
    registration.checkedInAt = new Date();
    return this.registrationRepository.save(registration);
  }

  /**
   * 获取报名列表
   * 仅活动创建者可查看，支持状态筛选和分页
   */
  async getRegistrations(
    eventId: string,
    userId: string,
    query: QueryRegistrationDto,
  ): Promise<{ items: RegistrationEntity[]; total: number }> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException('活动不存在');
    }
    if (event.creatorId !== userId) {
      throw new ForbiddenException('无权查看此活动的报名列表');
    }

    const where: FindOptionsWhere<RegistrationEntity> = { eventId };
    if (query.status) {
      where.status = query.status;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.registrationRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['user'],
    });

    return { items, total };
  }

  /**
   * 导出报名列表为 CSV
   * 仅活动创建者可操作
   */
  async exportRegistrations(eventId: string, userId: string): Promise<string> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException('活动不存在');
    }
    if (event.creatorId !== userId) {
      throw new ForbiddenException('无权导出此活动的报名数据');
    }

    const registrations = await this.registrationRepository.find({
      where: { eventId },
      order: { createdAt: 'ASC' },
      relations: ['user'],
    });

    // 构建 CSV 内容
    const headers = [
      '报名ID',
      '用户ID',
      '用户名',
      '邮箱',
      '报名状态',
      '签到状态',
      '签到时间',
      '报名时间',
    ];
    const rows = registrations.map((reg) => [
      reg.id,
      reg.userId,
      reg.user?.nickname || '',
      reg.email || '',
      reg.status,
      reg.checkInStatus,
      reg.checkedInAt?.toISOString() || '',
      reg.createdAt.toISOString(),
    ]);

    // 添加 BOM 头以支持中文 Excel 打开
    const csvContent =
      '\uFEFF' +
      headers.join(',') +
      '\n' +
      rows
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
        )
        .join('\n');

    return csvContent;
  }

  /**
   * 获取报名确认信封数据
   * 包含活动信息、报名状态、签到二维码
   * 公开接口，通过 registrationId 查询
   */
  async getConfirmation(registrationId: string): Promise<{
    registration: RegistrationEntity;
    event: EventEntity;
    qrCode: string;
  }> {
    const registration = await this.registrationRepository.findOne({
      where: { id: registrationId },
    });
    if (!registration) {
      throw new NotFoundException('报名记录不存在');
    }

    const event = await this.eventRepository.findOne({
      where: { id: registration.eventId },
    });
    if (!event) {
      throw new NotFoundException('活动不存在');
    }

    // 生成签到二维码（内容为 registrationId，用于现场扫码签到）
    const qrCode = await QRCode.toDataURL(registrationId, {
      width: 300,
      margin: 2,
    });

    return { registration, event, qrCode };
  }

  /**
   * 用户确认是否前来参加活动
   * 仅报名者本人可操作，仅 approved 状态可确认
   */
  async confirmAttendance(
    registrationId: string,
    userId: string,
    confirmed: boolean,
  ): Promise<RegistrationEntity> {
    const registration = await this.registrationRepository.findOne({
      where: { id: registrationId },
    });
    if (!registration) {
      throw new NotFoundException('报名记录不存在');
    }

    if (registration.userId !== userId) {
      throw new ForbiddenException('无权操作此报名记录');
    }

    if (registration.status !== 'approved') {
      throw new BadRequestException('仅已通过的报名可确认出席');
    }

    if (!confirmed) {
      // 用户确认不参加，等同于取消报名
      return this.cancel(registration.eventId, userId);
    }

    // 确认参加，无需额外操作，返回当前记录
    return registration;
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
      throw new BadRequestException('请填写报名问卷');
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

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere } from 'typeorm';
import { PaymentOrderEntity } from './payment-order.entity.js';
import { EventEntity } from '../event/event.entity.js';
import { EventTicketEntity } from '../event/event-ticket.entity.js';
import { RegistrationEntity } from '../registration/registration.entity.js';
import { CreatePaymentDto, QueryOrderDto } from './payment.dto.js';
import { generateId } from '../../shared/utils/id-generator.js';

/**
 * 支付服务
 * 处理支付订单创建、回调处理、退款和订单查询
 *
 * 注意：微信/支付宝真实支付接口使用 Mock 代替
 * 真实调用代码已注释并注明原因，待接入真实支付 SDK 时启用
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentOrderEntity)
    private readonly orderRepository: Repository<PaymentOrderEntity>,
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(EventTicketEntity)
    private readonly ticketRepository: Repository<EventTicketEntity>,
    @InjectRepository(RegistrationEntity)
    private readonly registrationRepository: Repository<RegistrationEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 创建支付订单
   * 验证活动、门票、报名记录后生成订单
   * 返回 Mock 支付链接（真实场景返回微信/支付宝预支付参数）
   */
  async createOrder(
    userId: string,
    dto: CreatePaymentDto,
  ): Promise<{ order: PaymentOrderEntity; payUrl: string }> {
    // 验证活动存在且已发布
    const event = await this.eventRepository.findOne({
      where: { id: dto.eventId },
    });
    if (!event) {
      throw new NotFoundException('活动不存在');
    }
    if (event.status !== 'published') {
      throw new BadRequestException('活动未发布');
    }

    // 验证门票
    const ticket = await this.ticketRepository.findOne({
      where: { id: dto.ticketId, eventId: dto.eventId },
    });
    if (!ticket) {
      throw new NotFoundException('门票不存在');
    }
    if (ticket.price <= 0) {
      throw new BadRequestException('免费门票无需支付');
    }

    // 验证报名记录
    const registration = await this.registrationRepository.findOne({
      where: { id: dto.registrationId, userId, eventId: dto.eventId },
    });
    if (!registration) {
      throw new NotFoundException('报名记录不存在');
    }

    // 检查是否已有未完成的支付订单
    const existingOrder = await this.orderRepository.findOne({
      where: {
        registrationId: dto.registrationId,
        status: 'pending',
      },
    });
    if (existingOrder) {
      // 返回已有的待支付订单
      return {
        order: existingOrder,
        payUrl: this.generateMockPayUrl(
          existingOrder.orderNo,
          dto.paymentMethod,
        ),
      };
    }

    // 生成订单号（时间戳 + 随机数，确保唯一）
    const orderNo = this.generateOrderNo();

    // 创建订单
    const order = this.orderRepository.create({
      eventId: dto.eventId,
      userId,
      ticketId: dto.ticketId,
      registrationId: dto.registrationId,
      orderNo,
      amount: ticket.price,
      status: 'pending',
      paymentMethod: dto.paymentMethod,
    });
    const savedOrder = await this.orderRepository.save(order);

    // Mock 支付链接（真实场景调用微信/支付宝下单 API）
    const payUrl = this.generateMockPayUrl(orderNo, dto.paymentMethod);

    /*
     * ===== 真实微信支付调用（暂不启用，需接入微信支付 SDK）=====
     *
     * const wxPayResult = await this.wxPayService.createUnifiedOrder({
     *   out_trade_no: orderNo,
     *   total_fee: Math.round(ticket.price * 100), // 微信支付金额单位为分
     *   body: `${event.title} - ${ticket.name}`,
     *   notify_url: `${process.env.API_BASE_URL}/api/payments/wechat/callback`,
     * });
     * payUrl = wxPayResult.code_url; // 二维码支付链接
     *
     * ===== 真实支付宝调用（暂不启用，需接入支付宝 SDK）=====
     *
     * const alipayResult = await this.alipayService.createTrade({
     *   out_trade_no: orderNo,
     *   total_amount: ticket.price.toString(),
     *   subject: `${event.title} - ${ticket.name}`,
     *   notify_url: `${process.env.API_BASE_URL}/api/payments/alipay/callback`,
     * });
     * payUrl = alipayResult.trade_url;
     */

    this.logger.log(
      `创建支付订单: ${orderNo}, 金额: ${ticket.price}, 方式: ${dto.paymentMethod}`,
    );

    return { order: savedOrder, payUrl };
  }

  /**
   * 处理微信支付回调
   * Mock 实现：直接标记订单为已支付
   * 真实场景需验证签名、解析回调数据
   */
  async handleWechatCallback(body: Record<string, unknown>): Promise<void> {
    const orderNo = body.out_trade_no as string;
    const transactionId = body.transaction_id as string;

    if (!orderNo) {
      throw new BadRequestException('缺少订单号');
    }

    /*
     * ===== 真实微信支付回调签名验证（暂不启用）=====
     *
     * const isValid = this.wxPayService.verifySignature(body);
     * if (!isValid) {
     *   throw new BadRequestException('签名验证失败');
     * }
     *
     * const tradeState = body.trade_state as string;
     * if (tradeState !== 'SUCCESS') {
     *   this.logger.warn(`微信支付未成功: ${orderNo}, 状态: ${tradeState}`);
     *   return;
     * }
     */

    await this.markOrderPaid(orderNo, transactionId || `mock_wx_${Date.now()}`);
  }

  /**
   * 处理支付宝支付回调
   * Mock 实现：直接标记订单为已支付
   * 真实场景需验证签名、解析回调数据
   */
  async handleAlipayCallback(body: Record<string, unknown>): Promise<void> {
    const orderNo = body.out_trade_no as string;
    const transactionId = body.trade_no as string;

    if (!orderNo) {
      throw new BadRequestException('缺少订单号');
    }

    /*
     * ===== 真实支付宝回调签名验证（暂不启用）=====
     *
     * const isValid = this.alipayService.verifySignature(body);
     * if (!isValid) {
     *   throw new BadRequestException('签名验证失败');
     * }
     *
     * const tradeStatus = body.trade_status as string;
     * if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
     *   this.logger.warn(`支付宝支付未成功: ${orderNo}, 状态: ${tradeStatus}`);
     *   return;
     * }
     */

    await this.markOrderPaid(
      orderNo,
      transactionId || `mock_ali_${Date.now()}`,
    );
  }

  /**
   * 获取当前用户的订单列表
   * 支持状态筛选和分页
   */
  async getMyOrders(
    userId: string,
    query: QueryOrderDto,
  ): Promise<{ items: PaymentOrderEntity[]; total: number }> {
    const where: FindOptionsWhere<PaymentOrderEntity> = { userId };
    if (query.status) {
      where.status = query.status;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.orderRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['event', 'ticket'],
    });

    return { items, total };
  }

  /**
   * 获取订单详情
   * 仅订单所属用户可查看
   */
  async getOrderDetail(
    orderId: string,
    userId: string,
  ): Promise<PaymentOrderEntity> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['event', 'ticket', 'registration'],
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('无权查看此订单');
    }
    return order;
  }

  /**
   * 退款
   * 仅活动创建者可操作，仅 paid 状态可退款
   * Mock 实现：直接标记为已退款
   */
  async refund(orderId: string, userId: string): Promise<PaymentOrderEntity> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['event'],
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 验证操作者是活动创建者
    if (order.event.creatorId !== userId) {
      throw new ForbiddenException('无权操作此订单');
    }

    if (order.status !== 'paid') {
      throw new BadRequestException('当前订单状态无法退款');
    }

    /*
     * ===== 真实微信退款调用（暂不启用）=====
     *
     * if (order.paymentMethod === 'wechat') {
     *   await this.wxPayService.refund({
     *     out_trade_no: order.orderNo,
     *     out_refund_no: `refund_${order.orderNo}`,
     *     total_fee: Math.round(order.amount * 100),
     *     refund_fee: Math.round(order.amount * 100),
     *   });
     * }
     *
     * ===== 真实支付宝退款调用（暂不启用）=====
     *
     * if (order.paymentMethod === 'alipay') {
     *   await this.alipayService.refund({
     *     out_trade_no: order.orderNo,
     *     refund_amount: order.amount.toString(),
     *     refund_reason: reason,
     *   });
     * }
     */

    return this.dataSource.transaction(async (manager) => {
      order.status = 'refunded';
      order.refundedAt = new Date();
      const saved = await manager.save(PaymentOrderEntity, order);

      // 退款后取消报名
      const registration = await manager.findOne(RegistrationEntity, {
        where: { id: order.registrationId },
      });
      if (registration && registration.status !== 'cancelled') {
        registration.status = 'cancelled';
        await manager.save(RegistrationEntity, registration);

        // 减少门票已售数量
        await manager.decrement(
          EventTicketEntity,
          { id: order.ticketId },
          'soldCount',
          1,
        );
      }

      this.logger.log(`订单退款成功: ${order.orderNo}`);
      return saved;
    });
  }

  /**
   * 获取活动的所有支付订单
   * 仅活动创建者可查看
   */
  async getEventPaymentOrders(
    eventId: string,
    userId: string,
    query: QueryOrderDto,
  ): Promise<{ items: PaymentOrderEntity[]; total: number }> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException('活动不存在');
    }
    if (event.creatorId !== userId) {
      throw new ForbiddenException('无权查看此活动的订单');
    }

    const where: FindOptionsWhere<PaymentOrderEntity> = { eventId };
    if (query.status) {
      where.status = query.status;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.orderRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['user', 'ticket'],
    });

    return { items, total };
  }

  /**
   * 标记订单为已支付
   * 同时更新报名状态为 approved（如需审核则保持 pending）
   */
  private async markOrderPaid(
    orderNo: string,
    transactionId: string,
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { orderNo },
    });
    if (!order) {
      this.logger.warn(`支付回调：订单不存在 ${orderNo}`);
      return;
    }

    if (order.status === 'paid') {
      this.logger.warn(`支付回调：订单已支付，跳过 ${orderNo}`);
      return;
    }

    if (order.status !== 'pending') {
      this.logger.warn(
        `支付回调：订单状态异常 ${orderNo}, status=${order.status}`,
      );
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      // 更新订单状态
      order.status = 'paid';
      order.transactionId = transactionId;
      order.paidAt = new Date();
      await manager.save(PaymentOrderEntity, order);

      // 更新报名状态（如果活动不需要审核，直接 approved）
      const registration = await manager.findOne(RegistrationEntity, {
        where: { id: order.registrationId },
      });
      if (registration) {
        const event = await manager.findOne(EventEntity, {
          where: { id: order.eventId },
        });
        if (event && !event.requireApproval) {
          registration.status = 'approved';
          await manager.save(RegistrationEntity, registration);

          // 增加门票已售数量
          await manager.increment(
            EventTicketEntity,
            { id: order.ticketId },
            'soldCount',
            1,
          );
        }
        // 如果需要审核，报名状态保持 pending，等管理员审核
      }

      this.logger.log(`订单支付成功: ${orderNo}, 交易号: ${transactionId}`);
    });
  }

  /**
   * 生成订单号
   * 格式：PAY + 年月日时分秒 + 6位随机数
   */
  private generateOrderNo(): string {
    const now = new Date();
    const dateStr =
      now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0') +
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `PAY${dateStr}${random}`;
  }

  /**
   * 生成 Mock 支付链接
   * 真实场景由微信/支付宝 SDK 返回
   */
  private generateMockPayUrl(orderNo: string, method: string): string {
    return `https://mock-pay.example.com/${method}/pay?order_no=${orderNo}&mock=true`;
  }

  /**
   * Mock 模拟支付成功
   * 开发/测试环境使用，模拟支付回调
   */
  async mockPaySuccess(orderNo: string): Promise<PaymentOrderEntity> {
    const order = await this.orderRepository.findOne({
      where: { orderNo },
    });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 'pending') {
      throw new BadRequestException('订单不是待支付状态');
    }

    const mockTransactionId = `mock_${order.paymentMethod}_${generateId()}`;
    await this.markOrderPaid(orderNo, mockTransactionId);

    // 返回更新后的订单
    const updatedOrder = await this.orderRepository.findOne({
      where: { orderNo },
      relations: ['event', 'ticket'],
    });
    return updatedOrder!;
  }
}

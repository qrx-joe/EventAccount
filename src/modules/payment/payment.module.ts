import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentOrderEntity } from './payment-order.entity.js';
import { EventEntity } from '../event/event.entity.js';
import { EventTicketEntity } from '../event/event-ticket.entity.js';
import { RegistrationEntity } from '../registration/registration.entity.js';
import {
  PaymentController,
  EventPaymentController,
} from './payment.controller.js';
import { PaymentService } from './payment.service.js';

/**
 * 支付模块
 * 处理支付订单创建、回调处理、退款和订单查询
 * 导出 PaymentService 供其他模块使用
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentOrderEntity,
      EventEntity,
      EventTicketEntity,
      RegistrationEntity,
    ]),
  ],
  controllers: [PaymentController, EventPaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}

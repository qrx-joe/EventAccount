import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { generateId } from '../../shared/utils/id-generator.js';
import { EventEntity } from '../event/event.entity.js';
import { UserEntity } from '../user/user.entity.js';
import { EventTicketEntity } from '../event/event-ticket.entity.js';
import { RegistrationEntity } from '../registration/registration.entity.js';

/**
 * 支付订单实体
 * 记录付费报名的支付状态、金额、支付方式等
 */
@Entity('payment_orders')
@Index('idx_payment_orders_user_id', ['userId'])
@Index('idx_payment_orders_event_id', ['eventId'])
@Index('idx_payment_orders_status', ['status'])
export class PaymentOrderEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({ type: 'varchar', length: 36, comment: '活动 ID' })
  eventId: string;

  @Column({ type: 'varchar', length: 36, comment: '用户 ID' })
  userId: string;

  @Column({ type: 'varchar', length: 36, comment: '门票 ID' })
  ticketId: string;

  @Column({ type: 'varchar', length: 36, comment: '报名记录 ID' })
  registrationId: string;

  @Column({
    type: 'varchar',
    length: 64,
    unique: true,
    comment: '订单号（唯一，用于支付平台对账）',
  })
  orderNo: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    comment: '订单金额（元）',
  })
  amount: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    comment: '订单状态：pending/paid/refunded/cancelled',
  })
  status: string;

  @Column({
    type: 'varchar',
    length: 20,
    comment: '支付方式：wechat/alipay',
  })
  paymentMethod: string;

  @Column({
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '第三方支付交易号',
  })
  transactionId: string | null;

  @Column({ type: 'timestamp', nullable: true, comment: '支付时间' })
  paidAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, comment: '退款时间' })
  refundedAt: Date | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  // ====== 关联关系 ======

  @ManyToOne(() => EventEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: EventEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ManyToOne(() => EventTicketEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticketId' })
  ticket: EventTicketEntity;

  @ManyToOne(() => RegistrationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'registrationId' })
  registration: RegistrationEntity;

  /** 插入前自动生成 UUIDv7 */
  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}

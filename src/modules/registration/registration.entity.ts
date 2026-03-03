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
  Unique,
} from 'typeorm';
import { generateId } from '../../shared/utils/id-generator.js';
import { EventEntity } from '../event/event.entity.js';
import { UserEntity } from '../user/user.entity.js';
import { EventTicketEntity } from '../event/event-ticket.entity.js';

/**
 * 活动报名记录实体
 * 记录用户对活动的报名状态、签到状态和问卷数据
 */
@Entity('registrations')
@Unique('uq_registrations_event_user', ['eventId', 'userId'])
@Index('idx_registrations_event_status', ['eventId', 'status'])
@Index('idx_registrations_user_id', ['userId'])
export class RegistrationEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({ type: 'varchar', length: 36, comment: '活动 ID' })
  eventId: string;

  @Column({ type: 'varchar', length: 36, comment: '报名用户 ID' })
  userId: string;

  @Column({
    type: 'varchar',
    length: 36,
    nullable: true,
    comment: '门票类型 ID',
  })
  ticketId: string | null;

  @Column({
    type: 'varchar',
    length: 30,
    default: 'pending',
    comment: '报名状态：pending/approved/rejected/cancelled/waitlisted',
  })
  status: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'not_checked_in',
    comment: '签到状态：not_checked_in/checked_in',
  })
  checkInStatus: string;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: '签到时间',
  })
  checkedInAt: Date | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '报名时填写的邮箱',
  })
  email: string | null;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: '报名问卷数据',
  })
  formData: Record<string, unknown> | null;

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

  @ManyToOne(() => EventTicketEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ticketId' })
  ticket: EventTicketEntity;

  /** 插入前自动生成 UUIDv7 */
  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}

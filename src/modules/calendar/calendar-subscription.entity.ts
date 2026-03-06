import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryColumn,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { generateId } from '../../shared/utils/id-generator.js';
import { CalendarEntity } from './calendar.entity.js';
import { UserEntity } from '../user/user.entity.js';

/**
 * 日历订阅实体
 * 用户订阅日历的记录
 */
@Entity('calendar_subscriptions')
@Index('idx_calendar_subscriptions_user_id', ['userId'])
@Index('idx_calendar_subscriptions_calendar_id', ['calendarId'])
@Index('idx_calendar_subscriptions_user_calendar', ['userId', 'calendarId'], { unique: true })
export class CalendarSubscriptionEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({ type: 'varchar', length: 36, comment: '用户 ID' })
  userId: string;

  @Column({ type: 'varchar', length: 36, comment: '日历 ID' })
  calendarId: string;

  @Column({
    type: 'boolean',
    default: true,
    comment: '是否接收通知',
  })
  receiveNotification: boolean;

  @CreateDateColumn({ comment: '订阅时间' })
  createdAt: Date;

  // ====== 关联关系 ======

  @ManyToOne(() => CalendarEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'calendarId' })
  calendar: CalendarEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  /** 插入前自动生成 UUIDv7 */
  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}

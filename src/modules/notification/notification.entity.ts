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
import { UserEntity } from '../user/user.entity.js';

/**
 * 站内通知实体
 * 记录用户的站内通知（报名确认、活动提醒、活动更新、系统通知）
 */
@Entity('notifications')
@Index('idx_notifications_user_id', ['userId'])
@Index('idx_notifications_user_read', ['userId', 'isRead'])
@Index('idx_notifications_type', ['type'])
export class NotificationEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({ type: 'varchar', length: 36, comment: '接收用户 ID' })
  userId: string;

  @Column({
    type: 'varchar',
    length: 30,
    comment:
      '通知类型：registration_confirm/event_reminder/event_update/system',
  })
  type: string;

  @Column({ type: 'varchar', length: 200, comment: '通知标题' })
  title: string;

  @Column({ type: 'text', comment: '通知内容' })
  content: string;

  @Column({
    type: 'varchar',
    length: 30,
    nullable: true,
    comment: '关联资源类型（event/registration 等）',
  })
  relatedType: string | null;

  @Column({
    type: 'varchar',
    length: 36,
    nullable: true,
    comment: '关联资源 ID',
  })
  relatedId: string | null;

  @Column({
    type: 'boolean',
    default: false,
    comment: '是否已读',
  })
  isRead: boolean;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  // ====== 关联关系 ======

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

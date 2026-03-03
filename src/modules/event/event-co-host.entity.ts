import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryColumn,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { generateId } from '../../shared/utils/id-generator.js';
import { EventEntity } from './event.entity.js';
import { UserEntity } from '../user/user.entity.js';

/**
 * 活动协办人实体
 * 联合唯一约束防止同一用户重复成为协办人
 */
@Entity('event_co_hosts')
@Unique(['eventId', 'userId'])
export class EventCoHostEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({ type: 'varchar', length: 36, comment: '活动 ID' })
  @Index('idx_event_co_hosts_event_id')
  eventId: string;

  @Column({ type: 'varchar', length: 36, comment: '协办人 user_id' })
  userId: string;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @ManyToOne(() => EventEntity, (event) => event.coHosts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'eventId' })
  event: EventEntity;

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

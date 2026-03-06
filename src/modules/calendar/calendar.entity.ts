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
import { CommunityEntity } from '../community/community.entity.js';

/**
 * 日历实体
 * 每个社区对应一个日历，用于展示社区活动
 */
@Entity('calendars')
@Index('idx_calendars_community_id', ['communityId'])
@Index('idx_calendars_creator_id', ['creatorId'])
@Index('idx_calendars_status', ['status'])
export class CalendarEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({ type: 'varchar', length: 36, comment: '关联社区 ID' })
  communityId: string;

  @Column({ type: 'varchar', length: 36, comment: '创建者 user_id' })
  creatorId: string;

  @Column({ type: 'varchar', length: 100, comment: '日历名称' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: '日历描述' })
  description: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
    comment: '状态：active/inactive',
  })
  status: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '主题颜色',
  })
  themeColor: string | null;

  @Column({
    type: 'boolean',
    default: true,
    comment: '是否公开可见',
  })
  isPublic: boolean;

  @Column({
    type: 'int',
    default: 0,
    comment: '订阅人数',
  })
  subscriberCount: number;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  // ====== 关联关系 ======

  @ManyToOne(() => CommunityEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'communityId' })
  community: CommunityEntity;

  /** 插入前自动生成 UUIDv7 */
  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}

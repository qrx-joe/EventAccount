import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
  BeforeInsert,
  ManyToOne,
  ManyToMany,
  OneToMany,
  JoinColumn,
  JoinTable,
  Index,
} from 'typeorm';
import { generateId } from '../../shared/utils/id-generator.js';
import { UserEntity } from '../user/user.entity.js';
import { CategoryEntity } from '../category/category.entity.js';
import { TagEntity } from '../tag/tag.entity.js';
import { EventTicketEntity } from './event-ticket.entity.js';
import { EventCoHostEntity } from './event-co-host.entity.js';

/**
 * 活动实体
 * 平台核心业务对象，包含活动基本信息、地点、门票、标签等
 */
@Entity('events')
@Index('idx_events_status_start_time', ['status', 'startTime'])
@Index('idx_events_location', ['latitude', 'longitude'])
export class EventEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({ type: 'varchar', length: 36, comment: '创建者 user_id' })
  @Index('idx_events_creator_id')
  creatorId: string;

  @Column({
    type: 'varchar',
    length: 36,
    nullable: true,
    comment: '所属社区 ID',
  })
  @Index('idx_events_community_id')
  communityId: string | null;

  @Column({
    type: 'varchar',
    length: 36,
    nullable: true,
    comment: '所属分类 ID',
  })
  @Index('idx_events_category_id')
  categoryId: string | null;

  @Column({ type: 'varchar', length: 255, comment: '活动名称' })
  title: string;

  @Column({ type: 'text', nullable: true, comment: '活动描述（富文本）' })
  description: string | null;

  @Column({ type: 'text', nullable: true, comment: '海报 URL' })
  coverImage: string | null;

  @Column({ type: 'timestamp', comment: '开始时间' })
  startTime: Date;

  @Column({ type: 'timestamp', comment: '结束时间' })
  endTime: Date;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'Asia/Shanghai',
    comment: '时区',
  })
  timezone: string;

  @Column({ type: 'varchar', length: 20, comment: '地点类型：offline/online' })
  locationType: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '地点名称',
  })
  locationName: string | null;

  @Column({ type: 'text', nullable: true, comment: '详细地址' })
  locationAddress: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 8,
    nullable: true,
    comment: '纬度',
  })
  latitude: number | null;

  @Column({
    type: 'decimal',
    precision: 11,
    scale: 8,
    nullable: true,
    comment: '经度',
  })
  longitude: number | null;

  @Column({ type: 'text', nullable: true, comment: '线上链接' })
  onlineLink: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'public',
    comment: '可见性：public/private',
  })
  visibility: string;

  @Column({
    type: 'boolean',
    default: false,
    comment: '是否需要审核报名',
  })
  requireApproval: boolean;

  @Column({
    type: 'int',
    default: 0,
    comment: '人数限制（0=无限制）',
  })
  capacity: number;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: '活动主题配置（模板/颜色/字体/外观）',
  })
  theme: Record<string, unknown> | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'draft',
    comment: '状态：draft/published/cancelled/completed',
  })
  status: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    comment: '审核状态：pending/approved/rejected',
  })
  auditStatus: string;

  @Column({ type: 'timestamp', nullable: true, comment: '发布时间' })
  publishedAt: Date | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  // ====== 关联关系 ======

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creatorId' })
  creator: UserEntity;

  @ManyToOne(() => CategoryEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category: CategoryEntity;

  @OneToMany(() => EventTicketEntity, (ticket) => ticket.event)
  tickets: EventTicketEntity[];

  @OneToMany(() => EventCoHostEntity, (coHost) => coHost.event)
  coHosts: EventCoHostEntity[];

  /** 活动标签多对多关联 */
  @ManyToMany(() => TagEntity)
  @JoinTable({
    name: 'event_tags',
    joinColumn: { name: 'event_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: TagEntity[];

  /** 插入前自动生成 UUIDv7 */
  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}

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
import { EventEntity } from './event.entity.js';

/**
 * 活动门票实体
 * 支持多级别门票（免费/付费），含售卖时间窗口
 */
@Entity('event_tickets')
export class EventTicketEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({ type: 'varchar', length: 36, comment: '所属活动 ID' })
  @Index('idx_event_tickets_event_id')
  eventId: string;

  @Column({ type: 'varchar', length: 100, comment: '票种名称' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: '票种描述' })
  description: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    comment: '价格（0=免费）',
  })
  price: number;

  @Column({
    type: 'int',
    default: 0,
    comment: '数量限制（0=无限制）',
  })
  quantity: number;

  @Column({
    type: 'int',
    default: 0,
    comment: '已售数量',
  })
  soldCount: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
    comment: '状态：active/disabled',
  })
  status: string;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: '开售时间',
  })
  saleStartTime: Date | null;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: '停售时间',
  })
  saleEndTime: Date | null;

  @Column({
    type: 'int',
    default: 0,
    comment: '排序权重',
  })
  sortOrder: number;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @ManyToOne(() => EventEntity, (event) => event.tickets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'eventId' })
  event: EventEntity;

  /** 插入前自动生成 UUIDv7 */
  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}

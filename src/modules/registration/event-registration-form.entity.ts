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
import { EventEntity } from '../event/event.entity.js';

/**
 * 报名问卷字段配置实体
 * 活动创建者可自定义报名时需要填写的问卷字段
 */
@Entity('event_registration_forms')
@Index('idx_event_forms_event_id', ['eventId'])
@Index('idx_event_forms_event_sort', ['eventId', 'sortOrder'])
export class EventRegistrationFormEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({ type: 'varchar', length: 36, comment: '所属活动 ID' })
  eventId: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: '字段标签（如 姓名/公司/职位）',
  })
  label: string;

  @Column({
    type: 'varchar',
    length: 20,
    comment: '字段类型：text/textarea/select/radio/checkbox/email/phone',
  })
  fieldType: string;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: '选项配置（select/radio/checkbox 的选项列表）',
  })
  options: string[] | null;

  @Column({
    type: 'boolean',
    default: false,
    comment: '是否必填',
  })
  isRequired: boolean;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '占位提示文本',
  })
  placeholder: string | null;

  @Column({
    type: 'int',
    default: 0,
    comment: '排序权重',
  })
  sortOrder: number;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  // ====== 关联关系 ======

  @ManyToOne(() => EventEntity, { onDelete: 'CASCADE' })
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

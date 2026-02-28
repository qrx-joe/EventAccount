import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryColumn,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { generateId } from '../../shared/utils/id-generator.js';
import { UserEntity } from '../user/user.entity.js';

/**
 * 标签实体
 * 支持用户创建和平台管理两种来源
 */
@Entity('tags')
export class TagEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
    comment: '标签名',
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'event',
    comment: '标签类型：event/community',
  })
  type: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'user',
    comment: '来源：user/platform',
  })
  source: string;

  @Column({
    type: 'varchar',
    length: 36,
    nullable: true,
    comment: '创建者 user_id',
  })
  createdBy: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdBy' })
  creator: UserEntity;

  @Column({
    type: 'int',
    default: 0,
    comment: '使用次数',
  })
  usageCount: number;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  /** 插入前自动生成 UUIDv7 */
  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}

import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';
import { generateId } from '../../shared/utils/id-generator.js';

/**
 * 活动分类实体
 * 平台级概念（如科技、美食、AI、艺术等），区别于用户自建标签
 */
@Entity('categories')
export class CategoryEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: '分类名称',
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
    comment: 'URL 标识',
  })
  slug: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: '分类描述',
  })
  description: string | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: '封面图 URL',
  })
  coverImage: string | null;

  @Column({
    type: 'int',
    default: 0,
    comment: '活动数量',
  })
  eventCount: number;

  @Column({
    type: 'int',
    default: 0,
    comment: '订阅者数量',
  })
  subscriberCount: number;

  @Column({
    type: 'int',
    default: 0,
    comment: '排序权重（越小越靠前）',
  })
  sortOrder: number;

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

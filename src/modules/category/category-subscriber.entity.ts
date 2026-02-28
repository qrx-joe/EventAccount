import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryColumn,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { generateId } from '../../shared/utils/id-generator.js';
import { CategoryEntity } from './category.entity.js';
import { UserEntity } from '../user/user.entity.js';

/**
 * 分类订阅者实体
 * 记录用户对分类的订阅关系（联合唯一约束防止重复订阅）
 */
@Entity('category_subscribers')
@Unique(['categoryId', 'userId'])
export class CategorySubscriberEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({ type: 'varchar', length: 36, comment: '分类 ID' })
  categoryId: string;

  @Column({ type: 'varchar', length: 36, comment: '订阅用户 ID' })
  userId: string;

  @ManyToOne(() => CategoryEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryId' })
  category: CategoryEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

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

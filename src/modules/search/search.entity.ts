import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryColumn,
  BeforeInsert,
  Index,
} from 'typeorm';
import { generateId } from '../../shared/utils/id-generator.js';

/**
 * 搜索记录实体
 * 记录用户的搜索历史，用于搜索建议和历史展示
 */
@Entity('search_records')
@Index('idx_search_records_user_id', ['userId'])
@Index('idx_search_records_keyword', ['keyword'])
@Index('idx_search_records_created_at', ['createdAt'])
export class SearchRecordEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({ type: 'varchar', length: 36, comment: '用户 ID' })
  userId: string;

  @Column({ type: 'varchar', length: 200, comment: '搜索关键词' })
  keyword: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'all',
    comment: '搜索类型：all/event/community',
  })
  type: string;

  @Column({ type: 'int', default: 0, comment: '搜索结果数量' })
  resultCount: number;

  @CreateDateColumn({ comment: '搜索时间' })
  createdAt: Date;

  /** 插入前自动生成 UUIDv7 */
  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}

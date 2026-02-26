import {
  Entity,
  Column,
  CreateDateColumn,
  PrimaryColumn,
  BeforeInsert,
  Index,
} from 'typeorm';
import { generateId } from '../../shared/utils/id-generator';

/**
 * 协议内容实体
 * 存储各类协议的版本化内容，不可修改（新版本创建新记录）
 */
@Index('IDX_agreements_type_date', ['type', 'effectiveDate'])
@Entity('agreements')
export class AgreementEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({
    type: 'varchar',
    length: 32,
    comment: '协议类型（user-terms / privacy-policy / payment-agreement）',
  })
  type: string;

  @Column({ type: 'varchar', length: 128, comment: '协议标题' })
  title: string;

  @Column({ type: 'varchar', length: 16, comment: '版本号（语义化）' })
  version: string;

  @Column({ type: 'text', comment: '协议正文（Markdown）' })
  content: string;

  @Column({ type: 'timestamp', comment: '生效日期' })
  effectiveDate: Date;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}

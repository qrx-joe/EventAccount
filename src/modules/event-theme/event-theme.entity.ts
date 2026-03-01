import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
  BeforeInsert,
  Index,
} from 'typeorm';
import { generateId } from '../../shared/utils/id-generator.js';

/**
 * 活动主题模板实体
 * 提供预设的主题样式供活动创建时选择
 */
@Entity('event_themes')
export class EventThemeEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({ type: 'varchar', length: 100, comment: '主题名称' })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true, comment: '主题标识' })
  @Index('idx_event_themes_slug')
  slug: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '颜色预设（如 warm/cool/neon/pastel）',
  })
  colorPreset: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '字体名称',
  })
  font: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'auto',
    comment: '外观模式：auto/light/dark',
  })
  appearance: string;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: '主题样式配置（颜色、背景、边框等）',
  })
  styles: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true, comment: '预览图 URL' })
  previewImage: string | null;

  @Column({ type: 'int', default: 0, comment: '排序权重' })
  sortOrder: number;

  @Column({
    type: 'boolean',
    default: true,
    comment: '是否启用（false 则不在列表展示）',
  })
  isActive: boolean;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  /** 插入前自动生成 UUIDv7 */
  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}

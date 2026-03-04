import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
  BeforeInsert,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
  JoinTable,
  Index,
} from 'typeorm';
import { generateId } from '../../shared/utils/id-generator.js';
import { UserEntity } from '../user/user.entity.js';
import { TagEntity } from '../tag/tag.entity.js';
import { CommunityMemberEntity } from './community-member.entity.js';

/**
 * 社区实体
 * 平台社区业务对象，包含社区基本信息、外观设置、成员管理等
 */
@Entity('communities')
@Index('idx_communities_status', ['status'])
@Index('idx_communities_creator_id', ['creatorId'])
export class CommunityEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({ type: 'varchar', length: 36, comment: '创建者 user_id' })
  creatorId: string;

  @Column({ type: 'varchar', length: 100, comment: '社区名称' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: '社区简介' })
  description: string | null;

  @Column({ type: 'text', nullable: true, comment: '社区头像 URL' })
  avatar: string | null;

  @Column({ type: 'text', nullable: true, comment: '社区封面图 URL' })
  coverImage: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
    comment: '状态：active/inactive/disbanded',
  })
  status: string;

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
    comment: '是否需要审核加入',
  })
  requireApproval: boolean;

  @Column({
    type: 'int',
    default: 0,
    comment: '成员数量',
  })
  memberCount: number;

  // ====== 外观设置 ======

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '主题颜色预设',
  })
  themeColor: string | null;

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: '自定义样式配置',
  })
  customStyles: Record<string, unknown> | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '自定义字体',
  })
  customFont: string | null;

  // ====== 功能设置 ======

  @Column({
    type: 'boolean',
    default: true,
    comment: '是否允许成员发起活动',
  })
  allowMemberEvent: boolean;

  @Column({
    type: 'boolean',
    default: true,
    comment: '是否开启社区讨论',
  })
  enableDiscussion: boolean;

  @Column({
    type: 'int',
    default: 0,
    comment: '每日发送限额（0=无限制）',
  })
  dailySendLimit: number;

  // ====== 嵌入设置 ======

  @Column({
    type: 'text',
    nullable: true,
    comment: '嵌入代码',
  })
  embedCode: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '自定义域名',
  })
  customDomain: string | null;

  // ====== 开发者设置 ======

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: 'API Key',
  })
  apiKey: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: 'Webhook URL',
  })
  webhookUrl: string | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  // ====== 关联关系 ======

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creatorId' })
  creator: UserEntity;

  @OneToMany(() => CommunityMemberEntity, (member) => member.community)
  members: CommunityMemberEntity[];

  /** 社区标签多对多关联 */
  @ManyToMany(() => TagEntity)
  @JoinTable({
    name: 'community_tags',
    joinColumn: { name: 'community_id', referencedColumnName: 'id' },
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

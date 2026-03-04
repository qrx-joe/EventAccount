import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { generateId } from '../../shared/utils/id-generator.js';
import { UserEntity } from '../user/user.entity.js';
import { CommunityEntity } from './community.entity.js';

/**
 * 社区成员实体
 * 记录用户与社区的关联关系及成员角色
 */
@Entity('community_members')
@Index('idx_community_members_community_id', ['communityId'])
@Index('idx_community_members_user_id', ['userId'])
@Index('idx_community_members_role', ['role'])
export class CommunityMemberEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({ type: 'varchar', length: 36, comment: '社区 ID' })
  communityId: string;

  @Column({ type: 'varchar', length: 36, comment: '用户 ID' })
  userId: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'member',
    comment: '角色：creator/admin/member',
  })
  role: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
    comment: '状态：active/inactive/blocked',
  })
  status: string;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: '加入时间',
  })
  joinedAt: Date | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: '申请备注/自我介绍',
  })
  remark: string | null;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  // ====== 关联关系 ======

  @ManyToOne(() => CommunityEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'communityId' })
  community: CommunityEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  /** 插入前自动生成 UUIDv7 */
  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}

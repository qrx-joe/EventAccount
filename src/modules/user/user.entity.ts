import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';
import { generateId } from '../../shared/utils/id-generator';

/**
 * 用户实体
 * 以手机号为主登录凭证
 */
@Entity('users')
export class UserEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({
    type: 'varchar',
    length: 20,
    unique: true,
    comment: '手机号（主登录凭证）',
  })
  phone: string;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '昵称',
  })
  nickname: string | null;

  @Column({
    type: 'varchar',
    length: 128,
    unique: true,
    nullable: true,
    comment: '邮箱',
  })
  email: string | null;

  @Column({
    type: 'varchar',
    length: 512,
    nullable: true,
    comment: '头像 URL',
  })
  avatar: string | null;

  @Column({
    type: 'varchar',
    length: 200,
    nullable: true,
    comment: '个性签名',
  })
  bio: string | null;

  @Column({
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '密码（bcrypt 哈希，微信用户可为空）',
    select: false,
  })
  password: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    unique: true,
    nullable: true,
    comment: '微信开放平台 OpenID',
    select: false,
  })
  wechatOpenId: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    unique: true,
    nullable: true,
    comment: '微信开放平台 UnionID',
    select: false,
  })
  wechatUnionId: string | null;

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

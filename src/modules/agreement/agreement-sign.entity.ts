import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  Index,
  Unique,
  CreateDateColumn,
} from 'typeorm';
import { generateId } from '../../shared/utils/id-generator';
import { UserEntity } from '../user/user.entity';

/**
 * 协议签署记录
 * 同一用户同一协议类型只保留最新签署记录（upsert）
 */
@Entity('agreement_signs')
@Unique('UQ_agreement_signs_user_type', ['userId', 'agreementType'])
export class AgreementSignEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Index('IDX_agreement_signs_userId')
  @Column({ type: 'varchar', length: 36, comment: '用户 ID' })
  userId: string;

  @Column({ type: 'varchar', length: 32, comment: '协议类型' })
  agreementType: string;

  @Column({ type: 'varchar', length: 16, comment: '签署时的协议版本' })
  version: string;

  @CreateDateColumn({ comment: '签署时间' })
  signedAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}

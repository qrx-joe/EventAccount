import {
  Injectable,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { PG_UNIQUE_VIOLATION } from '../../common/constants/postgres';
import { UserEntity } from './user.entity';
import { UserSelfDto } from './user.dto';
import { UserService } from './user.service';
import { VerificationService } from '../verification/verification.service';
import { VerificationCodeType } from '../verification/verification.dto';

/**
 * 用户安全服务
 * 负责密码/手机号/邮箱等安全相关变更
 * 验证码校验在此层完成；换绑操作使用事务保证冲突检查与写入的原子性
 */
@Injectable()
export class UserSecurityService {
  private readonly logger = new Logger(UserSecurityService.name);

  constructor(
    private readonly userService: UserService,
    private readonly verificationService: VerificationService,
    private readonly dataSource: DataSource,
  ) {}

  /** 修改密码（已登录状态，需验证旧密码） */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userService.findByIdWithPassword(userId);
    if (!user || !user.password) {
      throw new BadRequestException('当前账号未设置密码');
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('当前密码不正确');
    }

    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      throw new BadRequestException('新密码不能与当前密码相同');
    }

    await this.userService.updatePassword(userId, newPassword);
  }

  /**
   * 换绑手机号
   * 流程：先消耗验证码 → 事务内检查冲突 + 写入（消除 TOCTOU 窗口）
   * 唯一约束作为最终兜底
   */
  async changePhone(
    userId: string,
    newPhone: string,
    smsCode: string,
  ): Promise<UserSelfDto> {
    // 1. 消耗验证码（Redis 操作，不参与 DB 事务）
    const valid = await this.verificationService.verifyCode(
      newPhone,
      VerificationCodeType.BIND_PHONE,
      smsCode,
    );
    if (!valid) {
      throw new BadRequestException('验证码无效或已过期');
    }

    // 2. 事务内执行冲突检查 + 写入，避免 TOCTOU 竞态
    try {
      await this.dataSource.transaction(async (manager) => {
        const existing = await manager.findOne(UserEntity, {
          where: { phone: newPhone },
        });
        if (existing && existing.id !== userId) {
          throw new ConflictException('该手机号已被其他账号使用');
        }
        await manager.update(UserEntity, userId, { phone: newPhone });
      });
    } catch (err) {
      this.handleUniqueViolation(err, '该手机号已被其他账号使用');
    }

    this.logger.log(`用户手机号更新成功: ${userId}`);
    return this.userService.findOneSafe(userId);
  }

  /**
   * 换绑邮箱
   * 流程：先消耗验证码 → 事务内检查冲突 + 写入
   */
  async changeEmail(
    userId: string,
    newEmail: string,
    emailCode: string,
  ): Promise<UserSelfDto> {
    const normalized = this.userService.normalizeEmail(newEmail);

    // 1. 消耗验证码
    const valid = await this.verificationService.verifyCode(
      normalized,
      VerificationCodeType.BIND_EMAIL,
      emailCode,
    );
    if (!valid) {
      throw new BadRequestException('验证码无效或已过期');
    }

    // 2. 事务内执行冲突检查 + 写入
    try {
      await this.dataSource.transaction(async (manager) => {
        const existing = await manager.findOne(UserEntity, {
          where: { email: normalized },
        });
        if (existing && existing.id !== userId) {
          throw new ConflictException('该邮箱已被其他账号使用');
        }
        await manager.update(UserEntity, userId, { email: normalized });
      });
    } catch (err) {
      this.handleUniqueViolation(err, '该邮箱已被其他账号使用');
    }

    this.logger.log(`用户邮箱更新成功: ${userId}`);
    return this.userService.findOneSafe(userId);
  }

  /** 捕获 PG 23505 唯一约束冲突，转为友好的 409 */
  private handleUniqueViolation(err: unknown, message: string): never {
    if (
      err instanceof QueryFailedError &&
      (err as QueryFailedError & { code?: string }).code === PG_UNIQUE_VIOLATION
    ) {
      throw new ConflictException(message);
    }
    throw err;
  }
}

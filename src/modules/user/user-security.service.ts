import {
  Injectable,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { QueryFailedError } from 'typeorm';
import { PG_UNIQUE_VIOLATION } from '../../common/constants/postgres';
import { UserSelfDto } from './user.dto';
import { UserService } from './user.service';
import { VerificationService } from '../verification/verification.service';
import { VerificationCodeType } from '../verification/verification.dto';

/**
 * 用户安全服务
 * 负责密码/手机号/邮箱等安全相关变更
 * 验证码校验在此层完成，保证"先查冲突 → 再消耗验证码 → 再写入"的原子顺序
 */
@Injectable()
export class UserSecurityService {
  private readonly logger = new Logger(UserSecurityService.name);

  constructor(
    private readonly userService: UserService,
    private readonly verificationService: VerificationService,
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
   * 流程：先查冲突 → 再消耗验证码 → 再写入（避免验证码被浪费）
   */
  async changePhone(
    userId: string,
    newPhone: string,
    smsCode: string,
  ): Promise<UserSelfDto> {
    // 1. 先查冲突（不消耗验证码）
    const existing = await this.userService.findByPhone(newPhone);
    if (existing && existing.id !== userId) {
      throw new ConflictException('该手机号已被其他账号使用');
    }

    // 2. 冲突检查通过后再消耗验证码
    const valid = await this.verificationService.verifyCode(
      newPhone,
      VerificationCodeType.BIND_PHONE,
      smsCode,
    );
    if (!valid) {
      throw new BadRequestException('验证码无效或已过期');
    }

    // 3. 写入，兜底捕获数据库唯一约束冲突
    try {
      await this.userService.updateBasicFields(userId, { phone: newPhone });
    } catch (err) {
      this.handleUniqueViolation(err, '该手机号已被其他账号使用');
    }

    this.logger.log(`用户手机号更新成功: ${userId}`);
    return this.userService.findOneSafe(userId);
  }

  /**
   * 换绑邮箱
   * 流程：先查冲突 → 再消耗验证码 → 再写入
   */
  async changeEmail(
    userId: string,
    newEmail: string,
    emailCode: string,
  ): Promise<UserSelfDto> {
    const normalized = this.userService.normalizeEmail(newEmail);

    // 1. 先查冲突
    const existing = await this.userService.findByEmail(normalized);
    if (existing && existing.id !== userId) {
      throw new ConflictException('该邮箱已被其他账号使用');
    }

    // 2. 消耗验证码
    const valid = await this.verificationService.verifyCode(
      normalized,
      VerificationCodeType.BIND_EMAIL,
      emailCode,
    );
    if (!valid) {
      throw new BadRequestException('验证码无效或已过期');
    }

    // 3. 写入 + 唯一约束兜底
    try {
      await this.userService.updateBasicFields(userId, {
        email: normalized,
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

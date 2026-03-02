import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomInt, timingSafeEqual } from 'crypto';
import { VerificationCodeType } from './verification.dto';
import { VerificationStoreGateway } from './store/verification-store.gateway';
import { VerificationSenderService } from './verification-sender.service';

/** 最大验证尝试次数 */
const MAX_VERIFY_ATTEMPTS = 5;

const CODE_TTL_MS = 5 * 60 * 1000;

const RATE_LIMIT_TTL_MS = 60 * 1000;

/**
 * 验证码服务
 * 负责验证码的生成、频率限制、校验
 * 实际发送委托给 VerificationSenderService
 */
@Injectable()
export class VerificationService implements OnModuleDestroy {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly store: VerificationStoreGateway,
    private readonly sender: VerificationSenderService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.store.close();
  }

  /** 生成 6 位数字验证码（使用 crypto 安全随机数） */
  private generateCode(): string {
    return randomInt(100000, 1000000).toString();
  }

  /** 生成缓存 key */
  private getStoreKey(target: string, type: VerificationCodeType): string {
    return `${target}:${type}`;
  }

  /** 检查频率限制，超限则抛异常 */
  private async enforceRateLimit(key: string): Promise<void> {
    const remainMs = await this.store.getRateLimitRemainingMs(key);
    if (remainMs > 0) {
      const remainSeconds = Math.ceil(remainMs / 1000);
      throw new BadRequestException(
        `发送过于频繁，请 ${remainSeconds} 秒后再试`,
      );
    }
  }

  /**
   * 发送短信验证码
   * @returns true 发送成功，抛异常则失败
   */
  async sendSmsCode(
    phone: string,
    type: VerificationCodeType,
  ): Promise<boolean> {
    const key = this.getStoreKey(phone, type);
    await this.enforceRateLimit(key);

    const code = this.generateCode();

    // 先发送，成功后再缓存，避免发送失败却限频
    await this.sender.sendSms(phone, code, type);

    await this.store.saveCode(key, code, CODE_TTL_MS);
    await this.store.setRateLimit(key, RATE_LIMIT_TTL_MS);

    return true;
  }

  /**
   * 发送邮箱验证码
   * @returns true 发送成功，抛异常则失败
   */
  async sendEmailCode(
    email: string,
    type: VerificationCodeType,
  ): Promise<boolean> {
    const key = this.getStoreKey(email, type);
    await this.enforceRateLimit(key);

    const code = this.generateCode();

    // 先发送，成功后再缓存，避免发送失败却限频
    await this.sender.sendEmail(email, code, type);

    await this.store.saveCode(key, code, CODE_TTL_MS);
    await this.store.setRateLimit(key, RATE_LIMIT_TTL_MS);

    return true;
  }

  /**
   * 校验验证码
   * @returns true 校验通过，false 校验失败
   */
  async verifyCode(
    target: string,
    type: VerificationCodeType,
    code: string,
  ): Promise<boolean> {
    const key = this.getStoreKey(target, type);
    const entry = await this.store.getCodeEntry(key);

    if (!entry) {
      return false;
    }

    // 尝试次数超限，删除验证码并拒绝
    if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
      await this.store.deleteCode(key);
      this.logger.warn(`验证码尝试次数超限: ${target}, 类型: ${type}`);
      return false;
    }

    // 验证码不匹配，递增尝试次数（使用常量时间比较防止时序攻击）
    const a = Buffer.from(entry.code);
    const b = Buffer.from(code);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      await this.store.incrementAttempts(key);
      return false;
    }

    // 校验成功后删除，防止重复使用
    await this.store.deleteCode(key);
    return true;
  }

  async clearCodesForTest(): Promise<void> {
    await this.store.clearAllForTest();
  }

  async seedCodeForTest(
    target: string,
    type: VerificationCodeType,
    code: string,
  ): Promise<void> {
    await this.store.seedCodeForTest(target, type, code, CODE_TTL_MS);
  }
}

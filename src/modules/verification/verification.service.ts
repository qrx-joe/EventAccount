import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt, timingSafeEqual } from 'crypto';
import Dysmsapi20170525, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import { Config as OpenApiConfig } from '@alicloud/openapi-client';
import { RuntimeOptions } from '@alicloud/tea-util';
import { VerificationCodeType } from './verification.dto';

/** 验证码缓存条目 */
interface CodeEntry {
  code: string;
  expiresAt: number;
  /** 已尝试验证次数 */
  attempts: number;
}

/** 频率限制缓存条目 */
interface RateLimitEntry {
  nextAllowedAt: number;
}

/** 最大验证尝试次数 */
const MAX_VERIFY_ATTEMPTS = 5;

/** 清理过期条目的间隔（10 分钟） */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * 验证码服务
 * 负责验证码的生成、发送（阿里云 SMS / Mock）、校验
 */
@Injectable()
export class VerificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VerificationService.name);

  /** 验证码存储：key = "phone:type" */
  private readonly codeStore = new Map<string, CodeEntry>();

  /** 频率限制存储：key = "phone:type" */
  private readonly rateLimitStore = new Map<string, RateLimitEntry>();

  /** 阿里云 SMS 客户端（有配置时初始化） */
  private smsClient: Dysmsapi20170525 | null = null;

  /** SMS 签名和模板 */
  private signName = '';
  private templateCode = '';

  /** 清理定时器 */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initSmsClient();
  }

  /** 模块初始化时启动定期清理 */
  onModuleInit(): void {
    this.cleanupTimer = setInterval(
      () => this.cleanupExpiredEntries(),
      CLEANUP_INTERVAL_MS,
    );
    this.logger.log('验证码过期清理定时器已启动');
  }

  /** 模块销毁时清除定时器 */
  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /** 清理过期的验证码和频率限制条目 */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let codesCleaned = 0;
    let ratesCleaned = 0;

    for (const [key, entry] of this.codeStore) {
      if (now > entry.expiresAt) {
        this.codeStore.delete(key);
        codesCleaned++;
      }
    }

    for (const [key, entry] of this.rateLimitStore) {
      if (now > entry.nextAllowedAt) {
        this.rateLimitStore.delete(key);
        ratesCleaned++;
      }
    }

    if (codesCleaned > 0 || ratesCleaned > 0) {
      this.logger.debug(
        `清理过期条目：验证码 ${codesCleaned} 条，频率限制 ${ratesCleaned} 条`,
      );
    }
  }

  /** 初始化阿里云 SMS 客户端 */
  private initSmsClient(): void {
    const accessKeyId = this.configService.get<string>('sms.accessKeyId');
    const accessKeySecret = this.configService.get<string>(
      'sms.accessKeySecret',
    );
    this.signName = this.configService.get<string>('sms.signName') || '';
    this.templateCode =
      this.configService.get<string>('sms.templateCode') || '';
    const endpoint =
      this.configService.get<string>('sms.endpoint') || 'dysmsapi.aliyuncs.com';

    if (accessKeyId && accessKeySecret) {
      const config = new OpenApiConfig({
        accessKeyId,
        accessKeySecret,
        endpoint,
      });
      this.smsClient = new Dysmsapi20170525(config);
      this.logger.log('阿里云 SMS 客户端初始化成功');
    } else {
      this.logger.warn('SMS 配置缺失，将使用 Mock 模式发送验证码');
    }
  }

  /** 生成 6 位数字验证码（使用 crypto 安全随机数） */
  private generateCode(): string {
    return randomInt(100000, 1000000).toString();
  }

  /** 生成缓存 key */
  private getStoreKey(phone: string, type: VerificationCodeType): string {
    return `${phone}:${type}`;
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

    // 频率限制：同一手机号同一类型 60 秒内不能重复发送
    const rateLimit = this.rateLimitStore.get(key);
    if (rateLimit && Date.now() < rateLimit.nextAllowedAt) {
      const remainSeconds = Math.ceil(
        (rateLimit.nextAllowedAt - Date.now()) / 1000,
      );
      throw new BadRequestException(
        `发送过于频繁，请 ${remainSeconds} 秒后再试`,
      );
    }

    const code = this.generateCode();

    // 发送短信（先发送，成功后再缓存，避免发送失败却限频）
    if (this.smsClient && this.signName && this.templateCode) {
      const sent = await this.sendViaSdk(phone, code);
      if (!sent) {
        throw new BadRequestException('短信发送失败，请稍后重试');
      }
    } else {
      // Mock 模式
      this.logger.log(
        `[SMS Mock] 手机号: ${phone}, 验证码: ${code}, 类型: ${type}`,
      );
    }

    // 发送成功后缓存验证码，5 分钟过期，重置尝试次数
    this.codeStore.set(key, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
    });

    // 设置频率限制，60 秒
    this.rateLimitStore.set(key, {
      nextAllowedAt: Date.now() + 60 * 1000,
    });

    return true;
  }

  /** 通过阿里云 SDK 发送短信 */
  private async sendViaSdk(phone: string, code: string): Promise<boolean> {
    const request = new SendSmsRequest({
      phoneNumbers: phone,
      signName: this.signName,
      templateCode: this.templateCode,
      templateParam: JSON.stringify({ code }),
    });

    const runtime = new RuntimeOptions({});

    try {
      const response = await this.smsClient!.sendSmsWithOptions(
        request,
        runtime,
      );
      if (response.body?.code === 'OK') {
        this.logger.log(`短信发送成功: ${phone}`);
        return true;
      }
      this.logger.error(
        `短信发送失败: ${response.body?.code} - ${response.body?.message}`,
      );
      return false;
    } catch (error) {
      this.logger.error(`短信发送异常: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 校验验证码
   * @returns true 校验通过，false 校验失败
   */
  verifyCode(phone: string, type: VerificationCodeType, code: string): boolean {
    const key = this.getStoreKey(phone, type);
    const entry = this.codeStore.get(key);

    if (!entry) {
      return false;
    }

    // 已过期
    if (Date.now() > entry.expiresAt) {
      this.codeStore.delete(key);
      return false;
    }

    // 尝试次数超限，删除验证码并拒绝
    if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
      this.codeStore.delete(key);
      this.logger.warn(`验证码尝试次数超限: ${phone}, 类型: ${type}`);
      return false;
    }

    // 验证码不匹配，递增尝试次数（使用常量时间比较防止时序攻击）
    const a = Buffer.from(entry.code);
    const b = Buffer.from(code);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      entry.attempts++;
      return false;
    }

    // 校验成功后删除，防止重复使用
    this.codeStore.delete(key);
    return true;
  }
}

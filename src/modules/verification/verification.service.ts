import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt, timingSafeEqual } from 'crypto';
import Dysmsapi20170525, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import { Config as OpenApiConfig } from '@alicloud/openapi-client';
import { RuntimeOptions } from '@alicloud/tea-util';
import * as nodemailer from 'nodemailer';
import { VerificationCodeType } from './verification.dto';
import { VerificationStoreGateway } from './store/verification-store.gateway';

/** 最大验证尝试次数 */
const MAX_VERIFY_ATTEMPTS = 5;

const CODE_TTL_MS = 5 * 60 * 1000;

const RATE_LIMIT_TTL_MS = 60 * 1000;

/**
 * 验证码服务
 * 负责验证码的生成、发送（阿里云 SMS / Email / Mock）、校验
 */
@Injectable()
export class VerificationService implements OnModuleDestroy {
  private readonly logger = new Logger(VerificationService.name);

  /** 阿里云 SMS 客户端（有配置时初始化） */
  private smsClient: Dysmsapi20170525 | null = null;

  /** SMS 签名和模板 */
  private signName = '';
  private templateCode = '';

  /** 邮件 SMTP transporter（有配置时初始化） */
  private emailTransporter: nodemailer.Transporter | null = null;

  /** 发件人地址 */
  private emailFrom = '';

  constructor(
    private readonly configService: ConfigService,
    private readonly store: VerificationStoreGateway,
  ) {
    this.initSmsClient();
    this.initEmailTransport();
  }

  async onModuleDestroy(): Promise<void> {
    await this.store.close();
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

  /** 初始化邮件 SMTP transporter */
  private initEmailTransport(): void {
    const host = this.configService.get<string>('email.host');
    const port = this.configService.get<number>('email.port');
    const user = this.configService.get<string>('email.user');
    const pass = this.configService.get<string>('email.pass');
    this.emailFrom = this.configService.get<string>('email.from') || '';

    if (host && user && pass) {
      this.emailTransporter = nodemailer.createTransport({
        host,
        port: port || 465,
        secure: (port || 465) === 465,
        auth: { user, pass },
      });
      this.logger.log('邮件 SMTP transporter 初始化成功');
    } else {
      this.logger.warn('邮件 SMTP 配置缺失，将使用 Mock 模式发送邮箱验证码');
    }
  }

  /** 生成 6 位数字验证码（使用 crypto 安全随机数） */
  private generateCode(): string {
    return randomInt(100000, 1000000).toString();
  }

  /** 生成缓存 key */
  private getStoreKey(target: string, type: VerificationCodeType): string {
    return `${target}:${type}`;
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
    const remainMs = await this.store.getRateLimitRemainingMs(key);
    if (remainMs > 0) {
      const remainSeconds = Math.ceil(remainMs / 1000);
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

    // 频率限制：同一邮箱同一类型 60 秒内不能重复发送
    const remainMs = await this.store.getRateLimitRemainingMs(key);
    if (remainMs > 0) {
      const remainSeconds = Math.ceil(remainMs / 1000);
      throw new BadRequestException(
        `发送过于频繁，请 ${remainSeconds} 秒后再试`,
      );
    }

    const code = this.generateCode();

    // 根据验证码类型生成邮件标题和场景描述
    const subjectMap: Record<VerificationCodeType, string> = {
      [VerificationCodeType.LOGIN]: '登录验证码',
      [VerificationCodeType.RESET]: '密码重置验证码',
      [VerificationCodeType.REGISTER]: '注册验证码',
    };
    const subject = subjectMap[type] || '验证码通知';

    // 发送邮件（先发送，成功后再缓存，避免发送失败却限频）
    if (this.emailTransporter) {
      try {
        await this.emailTransporter.sendMail({
          from: this.emailFrom,
          to: email,
          subject,
          text: `您的${subject}是：${code}，有效期 5 分钟。请勿将验证码告知他人。`,
          html: `<p>您的${subject}是：<strong>${code}</strong>，有效期 5 分钟。</p><p>请勿将验证码告知他人。</p>`,
        });
        this.logger.log(`邮箱验证码发送成功: ${email}`);
      } catch (error) {
        this.logger.error(`邮箱验证码发送失败: ${(error as Error).message}`);
        throw new BadRequestException('邮件发送失败，请稍后重试');
      }
    } else {
      // Mock 模式
      this.logger.log(
        `[Email Mock] 邮箱: ${email}, 验证码: ${code}, 类型: ${type}`,
      );
    }

    await this.store.saveCode(key, code, CODE_TTL_MS);
    await this.store.setRateLimit(key, RATE_LIMIT_TTL_MS);

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

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Dysmsapi20170525, {
  SendSmsRequest,
} from '@alicloud/dysmsapi20170525';
import { Config as OpenApiConfig } from '@alicloud/openapi-client';
import { RuntimeOptions } from '@alicloud/tea-util';
import { VerificationCodeType } from './verification.dto';

/** 验证码缓存条目 */
interface CodeEntry {
  code: string;
  expiresAt: number;
}

/** 频率限制缓存条目 */
interface RateLimitEntry {
  nextAllowedAt: number;
}

/**
 * 验证码服务
 * 负责验证码的生成、发送（阿里云 SMS / Mock）、校验
 */
@Injectable()
export class VerificationService {
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

  constructor(private readonly configService: ConfigService) {
    this.initSmsClient();
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
      this.configService.get<string>('sms.endpoint') ||
      'dysmsapi.aliyuncs.com';

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

  /** 生成 6 位数字验证码 */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /** 生成缓存 key */
  private getStoreKey(phone: string, type: VerificationCodeType): string {
    return `${phone}:${type}`;
  }

  /**
   * 发送短信验证码
   * @returns true 发送成功，抛异常则失败
   */
  async sendSmsCode(phone: string, type: VerificationCodeType): Promise<boolean> {
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

    // 发送成功后缓存验证码，5 分钟过期
    this.codeStore.set(key, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
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
  verifyCode(
    phone: string,
    type: VerificationCodeType,
    code: string,
  ): boolean {
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

    // 验证码不匹配
    if (entry.code !== code) {
      return false;
    }

    // 校验成功后删除，防止重复使用
    this.codeStore.delete(key);
    return true;
  }
}

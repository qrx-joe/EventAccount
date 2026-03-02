import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Dysmsapi20170525, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import { Config as OpenApiConfig } from '@alicloud/openapi-client';
import { RuntimeOptions } from '@alicloud/tea-util';
import * as nodemailer from 'nodemailer';
import { VerificationCodeType } from './verification.dto';

/** 验证码类型 → 邮件主题 */
const SUBJECT_MAP: Record<VerificationCodeType, string> = {
  [VerificationCodeType.LOGIN]: '登录验证码',
  [VerificationCodeType.RESET]: '密码重置验证码',
  [VerificationCodeType.REGISTER]: '注册验证码',
  [VerificationCodeType.BIND_PHONE]: '换绑手机验证码',
  [VerificationCodeType.BIND_EMAIL]: '换绑邮箱验证码',
};

/**
 * 验证码发送服务
 * 负责通过阿里云 SMS 或 SMTP 邮件发送验证码
 * 无配置时降级为 Mock 日志输出
 */
@Injectable()
export class VerificationSenderService {
  private readonly logger = new Logger(VerificationSenderService.name);

  private smsClient: Dysmsapi20170525 | null = null;
  private signName = '';
  private templateCode = '';

  private emailTransporter: nodemailer.Transporter | null = null;
  private emailFrom = '';

  constructor(private readonly configService: ConfigService) {
    this.initSmsClient();
    this.initEmailTransport();
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

  /** 发送短信验证码（无配置时 Mock） */
  async sendSms(
    phone: string,
    code: string,
    type: VerificationCodeType,
  ): Promise<void> {
    if (this.smsClient && this.signName && this.templateCode) {
      await this.sendViaSdk(phone, code);
    } else {
      this.logger.log(
        `[SMS Mock] 手机号: ${phone}, 验证码: ${code}, 类型: ${type}`,
      );
    }
  }

  /** 发送邮箱验证码（无配置时 Mock） */
  async sendEmail(
    email: string,
    code: string,
    type: VerificationCodeType,
  ): Promise<void> {
    const subject = SUBJECT_MAP[type] || '验证码通知';

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
      this.logger.log(
        `[Email Mock] 邮箱: ${email}, 验证码: ${code}, 类型: ${type}`,
      );
    }
  }

  /** 通过阿里云 SDK 发送短信 */
  private async sendViaSdk(phone: string, code: string): Promise<void> {
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
        return;
      }
      this.logger.error(
        `短信发送失败: ${response.body?.code} - ${response.body?.message}`,
      );
    } catch (error) {
      this.logger.error(`短信发送异常: ${(error as Error).message}`);
    }
    throw new BadRequestException('短信发送失败，请稍后重试');
  }
}

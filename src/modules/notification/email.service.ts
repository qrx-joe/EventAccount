import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * 邮件通知服务
 * 负责发送报名确认邮件、活动提醒邮件和群发邮件
 *
 * 注意：SMTP 配置缺失时自动进入 Mock 模式，仅打印日志
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);

  /** 邮件 SMTP transporter */
  private transporter: nodemailer.Transporter | null = null;

  /** 发件人地址 */
  private emailFrom = '';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initTransport();
  }

  /** 初始化 SMTP transporter，配置缺失时进入 Mock 模式 */
  private initTransport(): void {
    const host = this.configService.get<string>('email.host');
    const port = this.configService.get<number>('email.port');
    const user = this.configService.get<string>('email.user');
    const pass = this.configService.get<string>('email.pass');
    this.emailFrom = this.configService.get<string>('email.from') || '';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: port || 465,
        secure: (port || 465) === 465,
        auth: { user, pass },
      });
      this.logger.log('邮件 SMTP transporter 初始化成功');
    } else {
      this.logger.warn('邮件 SMTP 配置缺失，将使用 Mock 模式发送通知邮件');
    }
  }

  /**
   * 发送报名确认邮件
   * 报名成功后通知用户
   */
  async sendRegistrationConfirmEmail(
    to: string,
    data: { eventTitle: string; registrationId: string },
  ): Promise<void> {
    const subject = `报名确认 - ${data.eventTitle}`;
    const html = `
      <h2>报名确认</h2>
      <p>您已成功报名活动：<strong>${data.eventTitle}</strong></p>
      <p>报名编号：${data.registrationId}</p>
      <p>请在活动开始前查看活动详情，了解最新信息。</p>
    `;
    await this.sendMail(to, subject, html);
  }

  /**
   * 发送活动提醒邮件
   * 活动开始前提醒参与者
   */
  async sendEventReminderEmail(
    to: string,
    data: { eventTitle: string; startTime: string },
  ): Promise<void> {
    const subject = `活动提醒 - ${data.eventTitle}`;
    const html = `
      <h2>活动提醒</h2>
      <p>您报名的活动 <strong>${data.eventTitle}</strong> 即将开始。</p>
      <p>开始时间：${data.startTime}</p>
      <p>请提前做好准备。</p>
    `;
    await this.sendMail(to, subject, html);
  }

  /**
   * 发送群发邮件
   * 活动创建者向参与者群发消息
   */
  async sendBroadcastEmail(
    to: string,
    data: { title: string; message: string; eventTitle: string },
  ): Promise<void> {
    const subject = `[${data.eventTitle}] ${data.title}`;
    const html = `
      <h2>${data.title}</h2>
      <p>${data.message}</p>
      <hr/>
      <p style="color: #666;">此消息来自活动「${data.eventTitle}」的组织者。</p>
    `;
    await this.sendMail(to, subject, html);
  }

  /**
   * 底层邮件发送方法
   * 有 SMTP 配置时真实发送，否则 Mock 打印日志
   */
  private async sendMail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    if (this.transporter && this.emailFrom) {
      try {
        await this.transporter.sendMail({
          from: this.emailFrom,
          to,
          subject,
          html,
        });
        this.logger.log(`邮件发送成功: ${to}, 主题: ${subject}`);
      } catch (error) {
        this.logger.error(
          `邮件发送失败: ${to}, 错误: ${(error as Error).message}`,
        );
      }
    } else {
      // Mock 模式：仅打印日志
      this.logger.log(`[Email Mock] 收件人: ${to}, 主题: ${subject}`);
    }
  }
}

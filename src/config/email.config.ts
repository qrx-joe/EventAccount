import { registerAs } from '@nestjs/config';

/**
 * 邮件 SMTP 配置（阿里云 DirectMail）
 * 从环境变量读取 SMTP 相关凭证和参数
 * 缺失时由 VerificationService 判断是否进入 Mock 模式
 */
export default registerAs('email', () => ({
  host: process.env.SMTP_HOST || '',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.SMTP_FROM || '',
}));

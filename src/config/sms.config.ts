import { registerAs } from '@nestjs/config';

/**
 * 阿里云短信服务配置
 * 从环境变量读取 SMS 相关凭证和参数
 */
export default registerAs('sms', () => ({
  accessKeyId: process.env.SMS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET || '',
  signName: process.env.SMS_SIGN_NAME || '',
  templateCode: process.env.SMS_TEMPLATE_CODE || '',
  endpoint: 'dysmsapi.aliyuncs.com',
}));

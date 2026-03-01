import { registerAs } from '@nestjs/config';

/**
 * 阿里云 OSS 对象存储配置
 * 从环境变量读取 OSS 相关凭证和参数
 */
export default registerAs('oss', () => ({
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  bucket: process.env.OSS_BUCKET || '',
  region: process.env.OSS_REGION || '',
  customDomain: process.env.OSS_CUSTOM_DOMAIN || '',
}));

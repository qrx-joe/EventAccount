import { registerAs } from '@nestjs/config';

/**
 * 微信开放平台配置
 * WECHAT_OPEN_APPID 为空时自动进入 Mock 模式
 */
export default registerAs('wechat', () => ({
  appId: process.env.WECHAT_OPEN_APPID || '',
  appSecret: process.env.WECHAT_OPEN_SECRET || '',
  callbackUrl:
    process.env.WECHAT_CALLBACK_URL || 'http://localhost:5173/wechat/callback',
}));

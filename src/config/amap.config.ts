import { registerAs } from '@nestjs/config';

/**
 * 高德地图 Web 服务配置
 * 从环境变量读取 API Key，提供基础请求 URL
 */
export default registerAs('amap', () => ({
  key: process.env.AMAP_KEY || '',
  baseUrl: 'https://restapi.amap.com/v3',
}));

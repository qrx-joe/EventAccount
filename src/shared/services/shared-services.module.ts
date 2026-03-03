import { Module } from '@nestjs/common';
import { AmapService } from './amap.service.js';

/**
 * 共享服务模块
 * 提供跨模块使用的第三方服务封装（高德地图等）
 */
@Module({
  providers: [AmapService],
  exports: [AmapService],
})
export class SharedServicesModule {}

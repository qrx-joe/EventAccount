import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller.js';
import { UploadService } from './upload.service.js';

/**
 * 文件上传模块
 * 无 TypeORM 依赖，仅声明 Controller 和 Service
 * 导出 Service 供其他模块使用
 */
@Module({
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}

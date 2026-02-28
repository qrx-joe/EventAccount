import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TagEntity } from './tag.entity.js';
import { TagController } from './tag.controller.js';
import { TagService } from './tag.service.js';

/**
 * 标签模块
 * 提供标签 CRUD、热门标签查询
 * 导出 TagService 供活动等模块使用
 */
@Module({
  imports: [TypeOrmModule.forFeature([TagEntity])],
  controllers: [TagController],
  providers: [TagService],
  exports: [TagService],
})
export class TagModule {}

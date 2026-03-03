import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryEntity } from './category.entity.js';
import { CategorySubscriberEntity } from './category-subscriber.entity.js';
import { CategoryController } from './category.controller.js';
import { CategoryService } from './category.service.js';

/**
 * 分类模块
 * 提供活动分类查询和订阅管理
 * 导出 CategoryService 供发现模块等使用
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([CategoryEntity, CategorySubscriberEntity]),
  ],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventThemeEntity } from './event-theme.entity.js';
import { EventThemeController } from './event-theme.controller.js';
import { EventThemeService } from './event-theme.service.js';

/**
 * 活动主题模块
 * 提供主题模板查询，导出 EventThemeService 供其他模块使用
 */
@Module({
  imports: [TypeOrmModule.forFeature([EventThemeEntity])],
  controllers: [EventThemeController],
  providers: [EventThemeService],
  exports: [EventThemeService],
})
export class EventThemeModule {}

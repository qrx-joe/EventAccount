import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEntity } from './calendar.entity.js';
import { CalendarSubscriptionEntity } from './calendar-subscription.entity.js';
import { CommunityEntity } from '../community/community.entity.js';
import { CalendarController } from './calendar.controller.js';
import { CalendarService } from './calendar.service.js';

/**
 * 日历模块
 * 注册日历及订阅实体，提供日历 CRUD、订阅管理等功能
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CalendarEntity,
      CalendarSubscriptionEntity,
      CommunityEntity,
    ]),
  ],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}

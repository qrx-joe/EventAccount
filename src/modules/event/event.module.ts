import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEntity } from './event.entity.js';
import { EventTicketEntity } from './event-ticket.entity.js';
import { EventCoHostEntity } from './event-co-host.entity.js';
import { EventController } from './event.controller.js';
import { EventService } from './event.service.js';

/**
 * 活动模块
 * 注册活动及子实体，提供活动 CRUD
 * 导出 EventService 供报名、发现等模块使用
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventEntity,
      EventTicketEntity,
      EventCoHostEntity,
    ]),
  ],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}

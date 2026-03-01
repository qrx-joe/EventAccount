import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegistrationEntity } from './registration.entity.js';
import { EventRegistrationFormEntity } from './event-registration-form.entity.js';
import { EventEntity } from '../event/event.entity.js';
import { EventTicketEntity } from '../event/event-ticket.entity.js';
import { RegistrationController } from './registration.controller.js';
import { RegistrationService } from './registration.service.js';

/**
 * 报名模块
 * 处理活动报名、取消报名和报名问卷配置
 * 导出 RegistrationService 供其他模块使用
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      RegistrationEntity,
      EventRegistrationFormEntity,
      EventEntity,
      EventTicketEntity,
    ]),
  ],
  controllers: [RegistrationController],
  providers: [RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationModule {}

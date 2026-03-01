import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity } from './notification.entity.js';
import { EventEntity } from '../event/event.entity.js';
import { RegistrationEntity } from '../registration/registration.entity.js';
import { NotificationController } from './notification.controller.js';
import { NotificationService } from './notification.service.js';
import { EmailService } from './email.service.js';

/**
 * 通知模块
 * 处理站内通知和邮件通知
 * 导出 NotificationService 供其他模块使用（报名确认通知等）
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationEntity,
      EventEntity,
      RegistrationEntity,
    ]),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, EmailService],
  exports: [NotificationService],
})
export class NotificationModule {}

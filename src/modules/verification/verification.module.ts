import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VerificationController } from './verification.controller';
import { EmailVerificationController } from './email-verification.controller';
import { VerificationService } from './verification.service';
import { VerificationSenderService } from './verification-sender.service';
import { VerificationStoreGateway } from './store/verification-store.gateway';

/**
 * 验证码模块
 * 提供短信/邮箱验证码发送和校验功能，供 auth 模块调用
 */
@Module({
  imports: [ConfigModule],
  controllers: [VerificationController, EmailVerificationController],
  providers: [
    VerificationStoreGateway,
    VerificationSenderService,
    VerificationService,
  ],
  exports: [VerificationService],
})
export class VerificationModule {}

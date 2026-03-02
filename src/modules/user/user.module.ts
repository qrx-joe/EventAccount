import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { UserService } from './user.service';
import { UserSecurityService } from './user-security.service';
import { AdminUserService } from './admin-user.service';
import { UserAccountController } from './user-account.controller';
import { UserController } from './user.controller';
import { AdminUserController } from './admin-user.controller';
import { VerificationModule } from '../verification/verification.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), VerificationModule],
  /** UserAccountController（/users/me/*）必须在 UserController 之前，避免 "me" 被 :id 捕获 */
  controllers: [UserAccountController, UserController, AdminUserController],
  providers: [UserService, UserSecurityService, AdminUserService],
  exports: [UserService],
})
export class UserModule {}

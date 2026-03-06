import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity, UserRole } from './user.entity';
import { UserService } from './user.service';
import { UserSecurityService } from './user-security.service';
import { AdminUserService } from './admin-user.service';
import { UserAccountController } from './user-account.controller';
import { UserController } from './user.controller';
import { AdminUserController } from './admin-user.controller';
import { VerificationModule } from '../verification/verification.module';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), VerificationModule],
  controllers: [UserAccountController, UserController, AdminUserController],
  providers: [UserService, UserSecurityService, AdminUserService],
  exports: [UserService],
})
export class UserModule implements OnModuleInit {
  private readonly logger = new Logger(UserModule.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async onModuleInit() {
    const adminPhone = '18000000000';
    const adminPassword = 'admin123';

    const user = await this.userRepo.findOne({ where: { phone: adminPhone } });

    if (user) {
      if (user.role !== UserRole.ADMIN) {
        user.role = UserRole.ADMIN;
        await this.userRepo.save(user);
        this.logger.log(`已将用户 ${adminPhone} 设置为管理员`);
      } else {
        this.logger.log(`管理员账户 ${adminPhone} 已存在`);
      }
    } else {
      const passwordHash = await bcrypt.hash(adminPassword, 12);

      const newUser = new UserEntity();
      newUser.phone = adminPhone;
      newUser.password = passwordHash;
      newUser.nickname = '管理员';
      newUser.role = UserRole.ADMIN;
      newUser.isActive = true;

      await this.userRepo.save(newUser);
      this.logger.log(`已自动创建管理员账户: ${adminPhone} / ${adminPassword}`);
    }
  }
}

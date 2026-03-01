import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { VerificationService } from '../verification/verification.service';
import { VerificationCodeType } from '../verification/verification.dto';
import {
  ForgotPasswordVerifyDto,
  ForgotPasswordEmailVerifyDto,
  ResetPasswordDto,
  ResetTokenPayload,
} from './auth.dto';

/**
 * 密码重置服务
 * 处理忘记密码流程：验证身份 → 签发重置 token → 重置密码
 */
@Injectable()
export class AuthResetService {
  private readonly logger = new Logger(AuthResetService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly verificationService: VerificationService,
  ) {}

  /** 忘记密码 - 手机验证身份 */
  async verifyResetCode(
    dto: ForgotPasswordVerifyDto,
  ): Promise<{ resetToken: string }> {
    const valid = await this.verificationService.verifyCode(
      dto.phone,
      VerificationCodeType.RESET,
      dto.smsCode,
    );
    if (!valid) {
      throw new BadRequestException('验证码无效或已过期');
    }

    const user = await this.userService.findByPhone(dto.phone);
    if (!user) {
      throw new BadRequestException('验证码无效或已过期');
    }

    this.logger.log(`用户申请重置密码: ${user.id}`);
    return { resetToken: this.signResetToken(user.id) };
  }

  /** 忘记密码 - 邮箱验证身份 */
  async verifyResetCodeByEmail(
    dto: ForgotPasswordEmailVerifyDto,
  ): Promise<{ resetToken: string }> {
    const valid = await this.verificationService.verifyCode(
      dto.email,
      VerificationCodeType.RESET,
      dto.emailCode,
    );
    if (!valid) {
      throw new BadRequestException('验证码无效或已过期');
    }

    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('验证码无效或已过期');
    }

    this.logger.log(`用户通过邮箱申请重置密码: ${user.id}`);
    return { resetToken: this.signResetToken(user.id) };
  }

  /** 重置密码：验证 token → 校验新旧密码 → 更新密码 */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('两次输入的密码不一致');
    }

    let payload: ResetTokenPayload;
    try {
      payload = this.jwtService.verify<ResetTokenPayload>(dto.resetToken);
    } catch {
      throw new UnauthorizedException('重置密码令牌无效或已过期');
    }

    if (payload.purpose !== 'password-reset') {
      throw new UnauthorizedException('令牌用途不正确');
    }

    const user = await this.userService.findByIdWithPassword(payload.sub);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (user.password) {
      const isSame = await bcrypt.compare(dto.newPassword, user.password);
      if (isSame) {
        throw new BadRequestException('新密码不能与旧密码相同');
      }
    }

    await this.userService.updatePassword(user.id, dto.newPassword);
    this.logger.log(`用户密码重置成功: ${user.id}`);
  }

  /** 签发短时效重置 token（10分钟有效） */
  private signResetToken(userId: string): string {
    const payload: ResetTokenPayload = {
      sub: userId,
      purpose: 'password-reset',
    };
    return this.jwtService.sign(payload, { expiresIn: '10m' });
  }
}

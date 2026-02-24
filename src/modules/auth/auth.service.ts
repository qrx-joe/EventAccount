import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { VerificationService } from '../verification/verification.service';
import { VerificationCodeType } from '../verification/verification.dto';
import { AgreementService } from '../agreement/agreement.service';
import {
  RegisterDto,
  LoginPasswordDto,
  SmsLoginDto,
  JwtPayload,
  ForgotPasswordVerifyDto,
  ResetPasswordDto,
  ResetTokenPayload,
} from './auth.dto';

/**
 * 认证服务
 * 负责注册、登录、token 签发
 * 通过 UserService 访问用户数据，不直接操作 Repository
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly verificationService: VerificationService,
    private readonly agreementService: AgreementService,
  ) {}

  /** 注册：校验验证码 → 创建用户 → 签发 token */
  async register(dto: RegisterDto): Promise<{ token: string }> {
    // 校验短信验证码
    const valid = this.verificationService.verifyCode(
      dto.phone,
      VerificationCodeType.REGISTER,
      dto.smsCode,
    );
    if (!valid) {
      throw new BadRequestException('验证码无效或已过期');
    }

    // 委托 UserService 创建用户
    const user = await this.userService.create({
      phone: dto.phone,
      password: dto.password,
      nickname: dto.nickname,
    });

    // 自动签署注册协议（用户条款 + 隐私政策）
    await this.agreementService.autoSignOnRegister(user.id);

    this.logger.log(`用户注册成功: ${user.id}`);
    return { token: this.signToken(user) };
  }

  /** 密码登录：通过 UserService 查询用户（含密码），校验密码后签发 token */
  async loginByPassword(dto: LoginPasswordDto): Promise<{ token: string }> {
    const user = await this.userService.findByPhoneWithPassword(dto.phone);

    if (!user) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    // 微信用户未设置密码，不能使用密码登录
    if (!user.password) {
      throw new UnauthorizedException('该账号未设置密码，请使用微信登录');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    this.logger.log(`用户密码登录成功: ${user.id}`);
    return { token: this.signToken(user) };
  }

  /** 短信验证码登录：校验验证码 → 查找用户（不存在则自动注册） → 签发 token */
  async loginBySms(dto: SmsLoginDto): Promise<{ token: string; isNewUser: boolean }> {
    const valid = this.verificationService.verifyCode(
      dto.phone,
      VerificationCodeType.LOGIN,
      dto.smsCode,
    );
    if (!valid) {
      throw new BadRequestException('验证码无效或已过期');
    }

    let user = await this.userService.findByPhone(dto.phone);
    let isNewUser = false;

    // 未注册用户自动创建账号（无密码）
    if (!user) {
      user = await this.userService.create({ phone: dto.phone });
      await this.agreementService.autoSignOnRegister(user.id);
      isNewUser = true;
      this.logger.log(`短信登录自动注册新用户: ${user.id}`);
    }

    this.logger.log(`用户短信登录成功: ${user.id}`);
    return { token: this.signToken(user), isNewUser };
  }

  /** 签发 JWT（只包含用户 ID，避免易变字段导致信息不一致） */
  private signToken(user: UserEntity): string {
    const payload: JwtPayload = {
      sub: user.id,
    };
    return this.jwtService.sign(payload);
  }

  /** 忘记密码 - 验证身份：校验验证码 → 签发重置 token */
  async verifyResetCode(
    dto: ForgotPasswordVerifyDto,
  ): Promise<{ resetToken: string }> {
    // 校验短信验证码
    const valid = this.verificationService.verifyCode(
      dto.phone,
      VerificationCodeType.RESET,
      dto.smsCode,
    );
    if (!valid) {
      throw new BadRequestException('验证码无效或已过期');
    }

    // 查找用户（统一错误信息，避免泄露手机号注册状态）
    const user = await this.userService.findByPhone(dto.phone);
    if (!user) {
      throw new BadRequestException('验证码无效或已过期');
    }

    // 签发短时效重置 token（10分钟有效）
    const payload: ResetTokenPayload = {
      sub: user.id,
      purpose: 'password-reset',
    };
    const resetToken = this.jwtService.sign(payload, { expiresIn: '10m' });

    this.logger.log(`用户申请重置密码: ${user.id}`);
    return { resetToken };
  }

  /** 重置密码：验证 token → 校验新旧密码 → 更新密码 */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    // 校验两次密码输入一致
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('两次输入的密码不一致');
    }

    // 手动验证 resetToken（不走 JwtAuthGuard，防止被当作登录 token 使用）
    let payload: ResetTokenPayload;
    try {
      payload = this.jwtService.verify<ResetTokenPayload>(dto.resetToken);
    } catch {
      throw new UnauthorizedException('重置密码令牌无效或已过期');
    }

    // 校验 token 用途
    if (payload.purpose !== 'password-reset') {
      throw new UnauthorizedException('令牌用途不正确');
    }

    // 查找用户（含密码字段）
    const user = await this.userService.findByIdWithPassword(payload.sub);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 新旧密码不能相同（微信用户首次设密码无旧密码，跳过比较）
    if (user.password) {
      const isSame = await bcrypt.compare(dto.newPassword, user.password);
      if (isSame) {
        throw new BadRequestException('新密码不能与旧密码相同');
      }
    }

    // 更新密码
    await this.userService.updatePassword(user.id, dto.newPassword);
    this.logger.log(`用户密码重置成功: ${user.id}`);
  }
}

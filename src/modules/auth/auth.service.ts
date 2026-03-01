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
  EmailLoginDto,
} from './auth.dto';

/**
 * 认证服务
 * 负责注册、登录、token 签发
 * 密码重置相关逻辑见 AuthResetService
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
    const valid = await this.verificationService.verifyCode(
      dto.phone,
      VerificationCodeType.REGISTER,
      dto.smsCode,
    );
    if (!valid) {
      throw new BadRequestException('验证码无效或已过期');
    }

    const user = await this.userService.create({
      phone: dto.phone,
      password: dto.password,
      nickname: dto.nickname,
    });

    await this.agreementService.autoSignOnRegister(user.id);

    this.logger.log(`用户注册成功: ${user.id}`);
    return { token: this.signToken(user) };
  }

  /** 密码登录 */
  async loginByPassword(dto: LoginPasswordDto): Promise<{ token: string }> {
    const user = await this.userService.findByPhoneWithPassword(dto.phone);
    if (!user || !user.password) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    this.logger.log(`用户密码登录成功: ${user.id}`);
    return { token: this.signToken(user) };
  }

  /** 短信验证码登录 */
  async loginBySms(dto: SmsLoginDto): Promise<{ token: string }> {
    const valid = await this.verificationService.verifyCode(
      dto.phone,
      VerificationCodeType.LOGIN,
      dto.smsCode,
    );
    if (!valid) {
      throw new BadRequestException('验证码无效或已过期');
    }

    const user = await this.userService.findByPhone(dto.phone);
    if (!user) {
      throw new BadRequestException('该手机号尚未注册，请先注册');
    }

    this.logger.log(`用户短信登录成功: ${user.id}`);
    return { token: this.signToken(user) };
  }

  /** 邮箱验证码登录 */
  async loginByEmail(dto: EmailLoginDto): Promise<{ token: string }> {
    const valid = await this.verificationService.verifyCode(
      dto.email,
      VerificationCodeType.LOGIN,
      dto.emailCode,
    );
    if (!valid) {
      throw new BadRequestException('验证码无效或已过期');
    }

    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('该邮箱尚未绑定，请先注册并绑定邮箱');
    }

    this.logger.log(`用户邮箱登录成功: ${user.id}`);
    return { token: this.signToken(user) };
  }

  /** 签发 JWT（只包含用户 ID） */
  private signToken(user: UserEntity): string {
    const payload: JwtPayload = { sub: user.id };
    return this.jwtService.sign(payload);
  }
}

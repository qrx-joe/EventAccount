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
import { RegisterDto, LoginDto, JwtPayload } from './auth.dto';

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

  /** 登录：通过 UserService 查询用户（含密码），校验密码后签发 token */
  async login(dto: LoginDto): Promise<{ token: string }> {
    const user = await this.userService.findByPhoneWithPassword(dto.phone);

    if (!user) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    this.logger.log(`用户登录成功: ${user.id}`);
    return { token: this.signToken(user) };
  }

  /** 签发 JWT（只包含用户 ID，避免易变字段导致信息不一致） */
  private signToken(user: UserEntity): string {
    const payload: JwtPayload = {
      sub: user.id,
    };
    return this.jwtService.sign(payload);
  }
}

import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../user/user.entity';
import { RegisterDto, LoginDto, JwtPayload } from './auth.dto';

/**
 * 认证服务
 * 负责注册、登录、token 签发
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
  ) {}

  /** 注册 */
  async register(dto: RegisterDto): Promise<{ token: string }> {
    // 校验手机号唯一性
    const exists = await this.userRepo.findOne({
      where: { phone: dto.phone },
    });
    if (exists) {
      throw new ConflictException('该手机号已注册');
    }

    const hashed = await bcrypt.hash(dto.password, 10);

    // 未传昵称时自动生成默认值
    const nickname = dto.nickname ?? `用户${dto.phone.slice(-4)}`;

    const user = this.userRepo.create({
      phone: dto.phone,
      password: hashed,
      nickname,
    });
    await this.userRepo.save(user);
    this.logger.log(`用户注册成功: ${user.id}`);

    return { token: this.signToken(user) };
  }

  /** 登录 */
  async login(dto: LoginDto): Promise<{ token: string }> {
    // password 字段 select: false，需要 addSelect
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.phone = :phone', { phone: dto.phone })
      .getOne();

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

  /** 签发 JWT */
  private signToken(user: UserEntity): string {
    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      nickname: user.nickname ?? '',
    };
    return this.jwtService.sign(payload);
  }
}

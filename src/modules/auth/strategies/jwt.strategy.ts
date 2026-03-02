import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../auth.dto';

/**
 * JWT 策略
 * 从 httpOnly Cookie 中解析并验证 JWT
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('环境变量 JWT_SECRET 未配置，服务无法启动');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: { cookies?: Record<string, string> }) =>
          req.cookies?.access_token || null,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /** 验证通过后将 payload 挂载到 request.user（拒绝非登录用途的 token） */
  validate(payload: JwtPayload & { purpose?: string }): JwtPayload {
    if (payload.purpose) {
      throw new UnauthorizedException('无效的认证令牌');
    }
    return { sub: payload.sub, role: payload.role };
  }
}

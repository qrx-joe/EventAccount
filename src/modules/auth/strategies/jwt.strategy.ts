import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../auth.dto';

/**
 * JWT 策略
 * 从 Authorization Bearer token 中解析并验证 JWT
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('环境变量 JWT_SECRET 未配置，服务无法启动');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /** 验证通过后将 payload 挂载到 request.user */
  validate(payload: JwtPayload): JwtPayload {
    return { sub: payload.sub };
  }
}

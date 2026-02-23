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
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'fallback-secret',
    });
  }

  /** 验证通过后将 payload 挂载到 request.user */
  validate(payload: JwtPayload): JwtPayload {
    return {
      sub: payload.sub,
      phone: payload.phone,
      nickname: payload.nickname,
    };
  }
}

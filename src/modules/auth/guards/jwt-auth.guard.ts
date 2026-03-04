import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT 认证守卫
 * 使用 @UseGuards(JwtAuthGuard) 保护需要登录的接口
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

/**
 * 可选 JWT 认证守卫
 * 支持匿名访问，但会尝试解析 token
 * 用于需要区分登录/未登录用户的接口
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: any, info: any, context: ExecutionContext, status?: any): TUser {
    // 不抛出错误，允许匿名访问
    return user || undefined;
  }
}

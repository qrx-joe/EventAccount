import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginPasswordDto,
  SmsLoginDto,
  ForgotPasswordVerifyDto,
  ResetPasswordDto,
  EmailLoginDto,
  ForgotPasswordEmailVerifyDto,
} from './auth.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * 认证控制器
 * 提供注册、登录接口（含速率限制）
 */
@ApiTags('认证')
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 注册：60 秒内最多 5 次 */
  @ApiOperation({ summary: '用户注册（手机号 + 密码 + 验证码）' })
  @ApiResponse({ status: 201, description: '注册成功，返回 JWT token' })
  @ApiResponse({ status: 409, description: '手机号已注册' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return ApiResponseDto.created(result, '注册成功');
  }

  /** 密码登录：60 秒内最多 10 次 */
  @ApiOperation({ summary: '密码登录（手机号 + 密码）' })
  @ApiResponse({ status: 200, description: '登录成功，返回 JWT token' })
  @ApiResponse({ status: 401, description: '手机号或密码错误' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('login/password')
  async loginByPassword(@Body() dto: LoginPasswordDto) {
    const result = await this.authService.loginByPassword(dto);
    return ApiResponseDto.ok(result, '登录成功');
  }

  /** 短信验证码登录：60 秒内最多 10 次 */
  @ApiOperation({ summary: '短信验证码登录' })
  @ApiResponse({
    status: 200,
    description: '登录成功，返回 JWT token',
  })
  @ApiResponse({
    status: 400,
    description: '验证码无效或已过期 / 该手机号尚未注册',
  })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('login/sms')
  async loginBySms(@Body() dto: SmsLoginDto) {
    const result = await this.authService.loginBySms(dto);
    return ApiResponseDto.ok(result, '登录成功');
  }

  /** 忘记密码 - 验证身份：60 秒内最多 5 次 */
  @ApiOperation({ summary: '忘记密码 - 验证身份（手机号 + 验证码）' })
  @ApiResponse({ status: 200, description: '验证成功，返回重置密码令牌' })
  @ApiResponse({ status: 400, description: '验证码无效或该手机号未注册' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('password/verify-reset')
  async verifyResetCode(@Body() dto: ForgotPasswordVerifyDto) {
    const result = await this.authService.verifyResetCode(dto);
    return ApiResponseDto.ok(result, '验证成功');
  }

  /** 邮箱验证码登录：60 秒内最多 10 次 */
  @ApiOperation({ summary: '邮箱验证码登录' })
  @ApiResponse({ status: 200, description: '登录成功，返回 JWT token' })
  @ApiResponse({ status: 400, description: '验证码无效或已过期 / 该邮箱尚未绑定' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('login/email')
  async loginByEmail(@Body() dto: EmailLoginDto) {
    const result = await this.authService.loginByEmail(dto);
    return ApiResponseDto.ok(result, '登录成功');
  }

  /** 忘记密码 - 邮箱验证身份：60 秒内最多 5 次 */
  @ApiOperation({ summary: '忘记密码 - 邮箱验证身份' })
  @ApiResponse({ status: 200, description: '验证成功，返回重置密码令牌' })
  @ApiResponse({ status: 400, description: '验证码无效、已过期或该邮箱未绑定账号' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('password/verify-reset-email')
  async verifyResetCodeByEmail(@Body() dto: ForgotPasswordEmailVerifyDto) {
    const result = await this.authService.verifyResetCodeByEmail(dto);
    return ApiResponseDto.ok(result, '验证成功');
  }

  /** 重置密码：60 秒内最多 5 次 */
  @ApiOperation({ summary: '重置密码（设置新密码）' })
  @ApiResponse({ status: 200, description: '密码重置成功' })
  @ApiResponse({ status: 400, description: '密码不一致或新密码与旧密码相同' })
  @ApiResponse({ status: 401, description: '重置密码令牌无效或已过期' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('password/reset')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return ApiResponseDto.ok(null, '密码重置成功');
  }
}

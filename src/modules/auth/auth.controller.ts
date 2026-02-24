import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto, LoginPasswordDto, SmsLoginDto } from './auth.dto';
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
  @ApiResponse({ status: 200, description: '登录成功，返回 JWT token' })
  @ApiResponse({ status: 400, description: '验证码无效或已过期' })
  @ApiResponse({ status: 401, description: '验证码无效或登录失败' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('login/sms')
  async loginBySms(@Body() dto: SmsLoginDto) {
    const result = await this.authService.loginBySms(dto);
    return ApiResponseDto.ok(result, '登录成功');
  }
}

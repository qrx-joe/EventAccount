import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './auth.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * 认证控制器
 * 提供注册、登录接口
 */
@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: '用户注册（手机号 + 密码）' })
  @ApiResponse({ status: 201, description: '注册成功，返回 JWT token' })
  @ApiResponse({ status: 409, description: '手机号已注册' })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return ApiResponseDto.created(result, '注册成功');
  }

  @ApiOperation({ summary: '用户登录（手机号 + 密码）' })
  @ApiResponse({ status: 200, description: '登录成功，返回 JWT token' })
  @ApiResponse({ status: 401, description: '手机号或密码错误' })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return ApiResponseDto.ok(result, '登录成功');
  }
}

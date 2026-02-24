import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { WechatOAuthService } from './wechat-oauth.service';
import { WechatCallbackQueryDto, WechatBindPhoneDto } from './wechat-oauth.dto';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';

/**
 * 微信登录控制器
 * 提供微信扫码登录的授权、回调、绑定手机号接口
 */
@ApiTags('微信登录')
@UseGuards(ThrottlerGuard)
@Controller('auth/wechat')
export class WechatOAuthController {
  constructor(private readonly wechatOAuthService: WechatOAuthService) {}

  /** 获取微信授权 URL：60 秒内最多 10 次 */
  @ApiOperation({ summary: '获取微信扫码登录授权 URL' })
  @ApiResponse({ status: 200, description: '返回微信授权 URL' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Get()
  getAuthorizeUrl() {
    const result = this.wechatOAuthService.getAuthorizeUrl();
    return ApiResponseDto.ok(result, '获取授权链接成功');
  }

  /** 微信回调处理 */
  @ApiOperation({ summary: '微信授权回调（前端中转调用）' })
  @ApiResponse({ status: 200, description: '返回登录 token 或绑定令牌' })
  @ApiResponse({ status: 401, description: 'state 无效或微信授权失败' })
  @Get('callback')
  async handleCallback(@Query() dto: WechatCallbackQueryDto) {
    const result = await this.wechatOAuthService.handleCallback(
      dto.code,
      dto.state,
    );
    return ApiResponseDto.ok(result, '微信回调处理成功');
  }

  /** 绑定手机号：60 秒内最多 5 次 */
  @ApiOperation({ summary: '微信登录绑定手机号' })
  @ApiResponse({ status: 200, description: '绑定成功，返回 JWT token' })
  @ApiResponse({ status: 401, description: '绑定令牌或验证码无效' })
  @ApiResponse({ status: 409, description: '该微信已绑定其他账号' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('bindphone')
  async bindPhone(@Body() dto: WechatBindPhoneDto) {
    const result = await this.wechatOAuthService.bindPhone(dto);
    return ApiResponseDto.ok(result, '绑定成功');
  }
}

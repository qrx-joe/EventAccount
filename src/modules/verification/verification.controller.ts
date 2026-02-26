import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { VerificationService } from './verification.service';
import { SendSmsCodeDto } from './verification.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * 验证码控制器
 * 提供短信验证码发送接口
 */
@ApiTags('认证')
@Controller('auth/sms')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @ApiOperation({ summary: '发送短信验证码' })
  @ApiResponse({ status: 200, description: '发送成功' })
  @ApiResponse({ status: 400, description: '参数错误或发送过于频繁' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('send')
  async sendSmsCode(@Body() dto: SendSmsCodeDto) {
    await this.verificationService.sendSmsCode(dto.phone, dto.type);
    return ApiResponseDto.ok(null, '验证码发送成功');
  }
}

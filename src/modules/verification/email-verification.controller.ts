import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { VerificationService } from './verification.service';
import { SendEmailCodeDto } from './verification.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * 邮箱验证码控制器
 * 提供邮箱验证码发送接口
 */
@ApiTags('认证')
@Controller('auth/email')
export class EmailVerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @ApiOperation({ summary: '发送邮箱验证码' })
  @ApiResponse({ status: 200, description: '发送成功' })
  @ApiResponse({ status: 400, description: '参数错误或发送过于频繁' })
  @ApiResponse({ status: 429, description: '请求过于频繁' })
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('send')
  async sendEmailCode(@Body() dto: SendEmailCodeDto) {
    await this.verificationService.sendEmailCode(dto.email, dto.type);
    return ApiResponseDto.ok(null, '验证码发送成功');
  }
}

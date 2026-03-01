import { Controller, Get, Put, Body, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { UserService } from './user.service';
import { UserSecurityService } from './user-security.service';
import { UserSelfDto } from './user.dto';
import {
  ChangePasswordDto,
  ChangePhoneDto,
  ChangeEmailDto,
} from './user-security.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.dto';

/**
 * 用户账号控制器
 * 处理当前登录用户的个人信息与安全变更（/users/me/*）
 * 验证码校验已下沉到 UserSecurityService，Controller 只做薄转发
 */
@ApiTags('用户-账号')
@Controller('users/me')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@ApiBearerAuth()
export class UserAccountController {
  constructor(
    private readonly userService: UserService,
    private readonly userSecurityService: UserSecurityService,
  ) {}

  /** 获取当前登录用户信息 */
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @Get()
  async getMe(
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<UserSelfDto>> {
    const user = await this.userService.findOneSafe(req.user.sub);
    return ApiResponseDto.ok(user);
  }

  /** 修改密码（已登录状态） */
  @ApiOperation({ summary: '修改密码' })
  @ApiResponse({ status: 200, description: '修改成功' })
  @ApiResponse({ status: 400, description: '密码不正确 / 新旧密码相同' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Put('password')
  async changePassword(
    @Req() req: { user: JwtPayload },
    @Body() dto: ChangePasswordDto,
  ): Promise<ApiResponseDto<null>> {
    await this.userSecurityService.changePassword(
      req.user.sub,
      dto.oldPassword,
      dto.newPassword,
    );
    return ApiResponseDto.ok(null, '密码修改成功');
  }

  /** 换绑手机号 */
  @ApiOperation({ summary: '换绑手机号' })
  @ApiResponse({ status: 200, description: '换绑成功' })
  @ApiResponse({ status: 400, description: '验证码无效' })
  @ApiResponse({ status: 409, description: '手机号已被使用' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Put('phone')
  async changePhone(
    @Req() req: { user: JwtPayload },
    @Body() dto: ChangePhoneDto,
  ): Promise<ApiResponseDto<UserSelfDto>> {
    const user = await this.userSecurityService.changePhone(
      req.user.sub,
      dto.newPhone,
      dto.smsCode,
    );
    return ApiResponseDto.ok(user, '手机号换绑成功');
  }

  /** 换绑邮箱 */
  @ApiOperation({ summary: '换绑邮箱' })
  @ApiResponse({ status: 200, description: '换绑成功' })
  @ApiResponse({ status: 400, description: '验证码无效' })
  @ApiResponse({ status: 409, description: '邮箱已被使用' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Put('email')
  async changeEmail(
    @Req() req: { user: JwtPayload },
    @Body() dto: ChangeEmailDto,
  ): Promise<ApiResponseDto<UserSelfDto>> {
    const user = await this.userSecurityService.changeEmail(
      req.user.sub,
      dto.newEmail,
      dto.emailCode,
    );
    return ApiResponseDto.ok(user, '邮箱换绑成功');
  }
}

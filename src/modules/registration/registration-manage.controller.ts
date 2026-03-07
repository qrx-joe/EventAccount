import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ApiResponseDto } from '../../common/dto/api-response.dto.js';
import { RegistrationService } from './registration.service.js';
import { RegistrationEntity } from './registration.entity.js';
import { EventEntity } from '../event/event.entity.js';
import { ConfirmAttendanceDto } from './registration.dto.js';
import { JwtPayload } from '../auth/auth.dto.js';

/**
 * 报名管理控制器
 * 处理以 /registrations/:id 为前缀的路由：审核、确认信封、确认出席
 */
@ApiTags('报名管理')
@Controller('registrations')
export class RegistrationManageController {
  constructor(private readonly registrationService: RegistrationService) {}

  /**
   * 审核通过报名
   * 需要登录，仅活动创建者可操作
   */
  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '审核通过报名' })
  @ApiParam({ name: 'id', description: '报名记录 ID' })
  @ApiResponse({ status: 200, description: '审核通过' })
  @ApiResponse({ status: 400, description: '当前状态无法审核' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '报名记录不存在' })
  async approve(
    @Param('id') id: string,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<RegistrationEntity>> {
    const registration = await this.registrationService.approve(
      id,
      req.user.sub,
    );
    return ApiResponseDto.ok(registration);
  }

  /**
   * 审核拒绝报名
   * 需要登录，仅活动创建者可操作
   */
  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '审核拒绝报名' })
  @ApiParam({ name: 'id', description: '报名记录 ID' })
  @ApiResponse({ status: 200, description: '已拒绝' })
  @ApiResponse({ status: 400, description: '当前状态无法拒绝' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '报名记录不存在' })
  async reject(
    @Param('id') id: string,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<RegistrationEntity>> {
    const registration = await this.registrationService.reject(
      id,
      req.user.sub,
    );
    return ApiResponseDto.ok(registration);
  }

  /**
   * 获取报名确认信封
   * 需要登录，仅报名者本人或活动创建者可访问
   */
  @Get(':id/confirmation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取报名确认信封' })
  @ApiParam({ name: 'id', description: '报名记录 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 403, description: '无权查看此报名' })
  @ApiResponse({ status: 404, description: '报名记录不存在' })
  async getConfirmation(
    @Param('id') id: string,
    @Request() req: { user: JwtPayload },
  ): Promise<
    ApiResponseDto<{
      registration: RegistrationEntity;
      event: EventEntity;
      qrCode: string;
    }>
  > {
    const result = await this.registrationService.getConfirmation(
      id,
      req.user.sub,
    );
    return ApiResponseDto.ok(result);
  }

  /**
   * 用户确认是否前来参加活动
   * 需要登录，仅报名者本人可操作
   */
  @Post(':id/confirm-attendance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '确认是否参加活动' })
  @ApiParam({ name: 'id', description: '报名记录 ID' })
  @ApiResponse({ status: 200, description: '确认成功' })
  @ApiResponse({ status: 400, description: '仅已通过的报名可确认' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '报名记录不存在' })
  async confirmAttendance(
    @Param('id') id: string,
    @Body() dto: ConfirmAttendanceDto,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<RegistrationEntity>> {
    const registration = await this.registrationService.confirmAttendance(
      id,
      req.user.sub,
      dto.confirmed,
    );
    return ApiResponseDto.ok(registration);
  }
}

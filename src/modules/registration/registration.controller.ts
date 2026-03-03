import {
  Controller,
  Post,
  Delete,
  Get,
  Put,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import * as express from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ApiResponseDto } from '../../common/dto/api-response.dto.js';
import { RegistrationService } from './registration.service.js';
import { RegistrationEntity } from './registration.entity.js';
import { EventRegistrationFormEntity } from './event-registration-form.entity.js';
import {
  CreateRegistrationDto,
  QueryRegistrationDto,
  CheckInDto,
} from './registration.dto.js';
import { SetRegistrationFormDto } from './registration-form.dto.js';
import { JwtPayload } from '../auth/auth.dto.js';

/**
 * 报名控制器
 * 处理活动报名、取消报名和报名问卷配置
 */
@ApiTags('活动报名')
@Controller('events/:eventId')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  /**
   * 报名活动
   * 需要登录
   */
  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '报名活动' })
  @ApiParam({ name: 'eventId', description: '活动 ID' })
  @ApiResponse({ status: 201, description: '报名成功' })
  @ApiResponse({ status: 400, description: '活动未发布/门票售罄/必填字段未填' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  @ApiResponse({ status: 409, description: '已报名此活动' })
  async register(
    @Param('eventId') eventId: string,
    @Body() dto: CreateRegistrationDto,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<RegistrationEntity>> {
    const registration = await this.registrationService.register(
      eventId,
      req.user.sub,
      dto,
    );
    return ApiResponseDto.created(registration);
  }

  /**
   * 取消报名
   * 需要登录，仅允许本人取消
   */
  @Delete('register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '取消报名' })
  @ApiParam({ name: 'eventId', description: '活动 ID' })
  @ApiResponse({ status: 200, description: '取消成功' })
  @ApiResponse({ status: 404, description: '报名记录不存在' })
  async cancel(
    @Param('eventId') eventId: string,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<RegistrationEntity>> {
    const registration = await this.registrationService.cancel(
      eventId,
      req.user.sub,
    );
    return ApiResponseDto.ok(registration);
  }

  /**
   * 获取报名问卷配置
   * 公开接口，报名前查看需要填写哪些字段
   */
  @Get('registration-form')
  @ApiOperation({ summary: '获取报名问卷配置' })
  @ApiParam({ name: 'eventId', description: '活动 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async getRegistrationForm(
    @Param('eventId') eventId: string,
  ): Promise<ApiResponseDto<EventRegistrationFormEntity[]>> {
    const form = await this.registrationService.getRegistrationForm(eventId);
    return ApiResponseDto.ok(form);
  }

  /**
   * 获取我的报名记录
   * 需要登录，仅查询当前用户的报名状态
   */
  @Get('my-registration')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取我的报名记录' })
  @ApiParam({ name: 'eventId', description: '活动 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '未找到报名记录' })
  async getMyRegistration(
    @Param('eventId') eventId: string,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<RegistrationEntity>> {
    const registration = await this.registrationService.getMyRegistration(
      eventId,
      req.user.sub,
    );
    return ApiResponseDto.ok(registration);
  }

  /**
   * 设置报名问卷配置
   * 需要登录，仅活动创建者可操作
   */
  @Put('registration-form')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '设置报名问卷配置' })
  @ApiParam({ name: 'eventId', description: '活动 ID' })
  @ApiResponse({ status: 200, description: '设置成功' })
  @ApiResponse({ status: 403, description: '无权操作此活动' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async setRegistrationForm(
    @Param('eventId') eventId: string,
    @Body() dto: SetRegistrationFormDto,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<EventRegistrationFormEntity[]>> {
    const form = await this.registrationService.setRegistrationForm(
      eventId,
      req.user.sub,
      dto,
    );
    return ApiResponseDto.ok(form);
  }

  /**
   * 导出报名列表 CSV
   * 需要登录，仅活动创建者可操作
   * 注意：此路由必须在 GET registrations 之前注册，避免路由匹配顺序问题
   */
  @Get('registrations/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '导出报名列表 CSV' })
  @ApiParam({ name: 'eventId', description: '活动 ID' })
  @ApiResponse({ status: 200, description: '导出成功' })
  @ApiResponse({ status: 403, description: '无权导出' })
  async exportRegistrations(
    @Param('eventId') eventId: string,
    @Request() req: { user: JwtPayload },
    @Res() res: express.Response,
  ): Promise<void> {
    const csv = await this.registrationService.exportRegistrations(
      eventId,
      req.user.sub,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="registrations-${eventId}.csv"`,
    );
    res.send(csv);
  }

  /**
   * 获取报名列表
   * 需要登录，仅活动创建者可查看
   */
  @Get('registrations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取报名列表' })
  @ApiParam({ name: 'eventId', description: '活动 ID' })
  @ApiQuery({ name: 'status', required: false, description: '报名状态筛选' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 403, description: '无权查看' })
  async getRegistrations(
    @Param('eventId') eventId: string,
    @Query() query: QueryRegistrationDto,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<{ items: RegistrationEntity[]; total: number }>> {
    const result = await this.registrationService.getRegistrations(
      eventId,
      req.user.sub,
      query,
    );
    return ApiResponseDto.ok(result);
  }

  /**
   * 扫码签到
   * 需要登录，仅活动创建者可操作
   */
  @Post('check-in')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '扫码签到' })
  @ApiParam({ name: 'eventId', description: '活动 ID' })
  @ApiResponse({ status: 200, description: '签到成功' })
  @ApiResponse({ status: 400, description: '报名未通过审核' })
  @ApiResponse({ status: 409, description: '已签到' })
  async checkIn(
    @Param('eventId') eventId: string,
    @Body() dto: CheckInDto,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<RegistrationEntity>> {
    const registration = await this.registrationService.checkIn(
      eventId,
      dto.registrationId,
      req.user.sub,
    );
    return ApiResponseDto.ok(registration);
  }
}

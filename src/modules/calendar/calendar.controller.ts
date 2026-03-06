import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CalendarService } from './calendar.service.js';
import {
  CreateCalendarDto,
  UpdateCalendarDto,
  QueryCalendarDto,
  SubscribeCalendarDto,
  CalendarResponseDto,
} from './calendar.dto.js';
import { ApiResponseDto } from '../../common/dto/api-response.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { JwtPayload } from '../auth/auth.dto.js';
import { CalendarEntity } from './calendar.entity.js';

/**
 * 日历控制器
 * 提供日历 CRUD、订阅管理等功能
 */
@ApiTags('日历')
@Controller('calendars')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  /**
   * 日历列表（分页）
   */
  @ApiOperation({ summary: '日历列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @Get()
  async findAll(
    @Query() query: QueryCalendarDto,
    @Req() req?: { user?: JwtPayload },
  ): Promise<ApiResponseDto<{ items: CalendarResponseDto[]; total: number }>> {
    const userId = req?.user?.sub;
    const result = await this.calendarService.findAll(query, userId);
    return ApiResponseDto.ok({
      items: result.items.map((item) => this.mapToResponseDto(item)),
      total: result.total,
    });
  }

  /**
   * 获取我的日历
   */
  @ApiOperation({ summary: '我的日历（我创建的社区的日历）' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: '查询成功' })
  @Get('my')
  async getMyCalendars(
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<CalendarResponseDto[]>> {
    const calendars = await this.calendarService.getMyCalendars(req.user.sub);
    return ApiResponseDto.ok(
      calendars.map((item) => this.mapToResponseDto(item)),
    );
  }

  /**
   * 获取我订阅的日历
   */
  @ApiOperation({ summary: '我订阅的日历' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: '查询成功' })
  @Get('my/subscribed')
  async getMySubscribedCalendars(
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<CalendarResponseDto[]>> {
    const subscriptions = await this.calendarService.getMySubscribedCalendars(
      req.user.sub,
    );
    const calendars = subscriptions.map((sub) => ({
      ...this.mapToResponseDto(sub.calendar),
      isSubscribed: true,
    }));
    return ApiResponseDto.ok(calendars);
  }

  /**
   * 获取社区日历
   */
  @ApiOperation({ summary: '获取社区的日历' })
  @ApiParam({ name: 'communityId', description: '社区 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '日历不存在' })
  @Get('community/:communityId')
  async findByCommunityId(
    @Param('communityId', ParseUUIDPipe) communityId: string,
  ): Promise<ApiResponseDto<CalendarResponseDto | null>> {
    const calendar = await this.calendarService.findByCommunityId(communityId);
    return ApiResponseDto.ok(calendar ? this.mapToResponseDto(calendar) : null);
  }

  /**
   * 日历详情
   */
  @ApiOperation({ summary: '日历详情' })
  @ApiParam({ name: 'id', description: '日历 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '日历不存在' })
  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: { user?: JwtPayload },
  ): Promise<ApiResponseDto<CalendarResponseDto>> {
    const userId = req?.user?.sub;
    const calendar = await this.calendarService.findById(id, userId);
    return ApiResponseDto.ok(this.mapToResponseDto(calendar));
  }

  /**
   * 创建日历
   */
  @ApiOperation({ summary: '创建日历' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 400, description: '该社区已存在日历' })
  @ApiResponse({ status: 403, description: '无权创建' })
  @Post()
  async create(
    @Body() dto: CreateCalendarDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<CalendarResponseDto>> {
    const calendar = await this.calendarService.create(dto, req.user.sub);
    return ApiResponseDto.created(this.mapToResponseDto(calendar), '创建成功');
  }

  /**
   * 更新日历
   */
  @ApiOperation({ summary: '更新日历' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '日历 ID' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 403, description: '无权更新' })
  @ApiResponse({ status: 404, description: '日历不存在' })
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalendarDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<CalendarResponseDto>> {
    const calendar = await this.calendarService.update(id, dto, req.user.sub);
    return ApiResponseDto.ok(this.mapToResponseDto(calendar), '更新成功');
  }

  /**
   * 删除日历
   */
  @ApiOperation({ summary: '删除日历' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '日历 ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 403, description: '无权删除' })
  @ApiResponse({ status: 404, description: '日历不存在' })
  @Delete(':id')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<null>> {
    await this.calendarService.delete(id, req.user.sub);
    return ApiResponseDto.ok(null, '删除成功');
  }

  /**
   * 订阅日历
   */
  @ApiOperation({ summary: '订阅日历' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 201, description: '订阅成功' })
  @ApiResponse({ status: 400, description: '已订阅或不能订阅自己的日历' })
  @Post('subscribe')
  async subscribe(
    @Body() dto: SubscribeCalendarDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<CalendarResponseDto>> {
    await this.calendarService.subscribe(dto, req.user.sub);
    const calendar = await this.calendarService.findById(
      dto.calendarId,
      req.user.sub,
    );
    return ApiResponseDto.created(this.mapToResponseDto(calendar), '订阅成功');
  }

  /**
   * 取消订阅
   */
  @ApiOperation({ summary: '取消订阅日历' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'calendarId', description: '日历 ID' })
  @ApiResponse({ status: 200, description: '取消订阅成功' })
  @ApiResponse({ status: 404, description: '未订阅该日历' })
  @Delete('subscribe/:calendarId')
  async unsubscribe(
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<null>> {
    await this.calendarService.unsubscribe(calendarId, req.user.sub);
    return ApiResponseDto.ok(null, '取消订阅成功');
  }

  /**
   * 检查是否已订阅
   */
  @ApiOperation({ summary: '检查是否已订阅日历' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'calendarId', description: '日历 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @Get('subscribe/:calendarId/check')
  async isSubscribed(
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<{ isSubscribed: boolean }>> {
    const isSubscribed = await this.calendarService.isSubscribed(
      calendarId,
      req.user.sub,
    );
    return ApiResponseDto.ok({ isSubscribed });
  }

  /**
   * 将实体映射为响应 DTO
   */
  private mapToResponseDto(
    calendar: CalendarEntity & { isSubscribed?: boolean },
  ): CalendarResponseDto {
    return {
      id: calendar.id,
      communityId: calendar.communityId,
      creatorId: calendar.creatorId,
      name: calendar.name,
      description: calendar.description,
      status: calendar.status,
      themeColor: calendar.themeColor,
      isPublic: calendar.isPublic,
      subscriberCount: calendar.subscriberCount,
      createdAt:
        calendar.createdAt instanceof Date
          ? calendar.createdAt.toISOString()
          : calendar.createdAt,
      updatedAt:
        calendar.updatedAt instanceof Date
          ? calendar.updatedAt.toISOString()
          : calendar.updatedAt,
      community: calendar.community
        ? {
            id: calendar.community.id,
            name: calendar.community.name,
            avatar: calendar.community.avatar,
          }
        : undefined,
      isSubscribed: calendar.isSubscribed,
    };
  }
}

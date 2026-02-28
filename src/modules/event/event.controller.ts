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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { JwtPayload } from '../auth/auth.dto.js';
import { ApiResponseDto } from '../../common/dto/api-response.dto.js';
import { EventService } from './event.service.js';
import { EventEntity } from './event.entity.js';
import { CreateEventDto, UpdateEventDto, QueryEventDto } from './event.dto.js';
import { CreateTicketDto, UpdateTicketDto } from './ticket.dto.js';
import { EventTicketEntity } from './event-ticket.entity.js';
import { AmapService } from '../../shared/services/amap.service.js';
import {
  SearchLocationDto,
  GeocodeDto,
  ReverseGeocodeDto,
} from './dto/location.dto.js';

@ApiTags('活动')
@Controller('events')
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly amapService: AmapService,
  ) {}

  // ==================== 地图相关接口（公开，无需登录） ====================

  /**
   * 搜索地点（POI 文本搜索）
   * 公开接口，无需登录
   */
  @Get('locations/search')
  @ApiOperation({ summary: '搜索地点' })
  @ApiResponse({ status: 200, description: '搜索成功' })
  async searchLocation(
    @Query() dto: SearchLocationDto,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.amapService.searchPlace(
      dto.keywords,
      dto.city,
      dto.page,
      dto.limit,
    );
    return ApiResponseDto.ok(result);
  }

  /**
   * 地理编码：地址 -> 坐标
   * 公开接口，无需登录
   */
  @Get('locations/geocode')
  @ApiOperation({ summary: '地理编码' })
  @ApiResponse({ status: 200, description: '编码成功' })
  async geocode(@Query() dto: GeocodeDto): Promise<ApiResponseDto<unknown>> {
    const result = await this.amapService.geocode(dto.address, dto.city);
    return ApiResponseDto.ok(result);
  }

  /**
   * 逆地理编码：坐标 -> 地址
   * 公开接口，无需登录
   */
  @Get('locations/reverse-geocode')
  @ApiOperation({ summary: '逆地理编码' })
  @ApiResponse({ status: 200, description: '解码成功' })
  async reverseGeocode(
    @Query() dto: ReverseGeocodeDto,
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.amapService.reverseGeocode(
      dto.longitude,
      dto.latitude,
    );
    return ApiResponseDto.ok(result);
  }

  // ==================== 活动 CRUD 接口 ====================

  /**
   * 创建活动
   * 需要登录，默认为 draft 状态
   */
  @Post()
  @ApiOperation({ summary: '创建活动' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 201, description: '创建成功' })
  async create(
    @Body() dto: CreateEventDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<EventEntity>> {
    const event = await this.eventService.create(dto, req.user.sub);
    return ApiResponseDto.created(event, '创建成功');
  }

  /**
   * 获取活动列表
   * 支持状态筛选、分类筛选、关键词搜索
   */
  @Get()
  @ApiOperation({ summary: '获取活动列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findAll(
    @Query() query: QueryEventDto,
  ): Promise<ApiResponseDto<{ items: EventEntity[]; total: number }>> {
    const result = await this.eventService.findAll(query);
    return ApiResponseDto.ok(result);
  }

  // ==================== 活动状态管理接口 ====================

  /**
   * 发布活动
   * 仅创建者可操作，仅 draft 状态可发布
   */
  @Post(':id/publish')
  @ApiOperation({ summary: '发布活动' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '活动 ID' })
  @ApiResponse({ status: 200, description: '发布成功' })
  @ApiResponse({ status: 400, description: '状态不允许发布' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async publish(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<EventEntity>> {
    const event = await this.eventService.publish(id, req.user.sub);
    return ApiResponseDto.ok(event, '发布成功');
  }

  /**
   * 取消活动
   * 仅创建者可操作，仅 published 状态可取消
   */
  @Post(':id/cancel')
  @ApiOperation({ summary: '取消活动' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '活动 ID' })
  @ApiResponse({ status: 200, description: '取消成功' })
  @ApiResponse({ status: 400, description: '状态不允许取消' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async cancel(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<EventEntity>> {
    const event = await this.eventService.cancel(id, req.user.sub);
    return ApiResponseDto.ok(event, '取消成功');
  }

  /**
   * 复制活动
   * 仅创建者可操作，创建新的 draft 副本
   */
  @Post(':id/copy')
  @ApiOperation({ summary: '复制活动' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '活动 ID' })
  @ApiResponse({ status: 201, description: '复制成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async copy(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<EventEntity>> {
    const event = await this.eventService.copy(id, req.user.sub);
    return ApiResponseDto.created(event, '复制成功');
  }

  /**
   * 获取活动详情
   * 无需登录
   */
  @Get(':id')
  @ApiOperation({ summary: '获取活动详情' })
  @ApiParam({ name: 'id', description: '活动 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async findById(
    @Param('id') id: string,
  ): Promise<ApiResponseDto<EventEntity>> {
    const event = await this.eventService.findById(id);
    return ApiResponseDto.ok(event);
  }

  /**
   * 更新活动
   * 仅创建者可操作
   */
  @Patch(':id')
  @ApiOperation({ summary: '更新活动' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '活动 ID' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<EventEntity>> {
    const event = await this.eventService.update(id, dto, req.user.sub);
    return ApiResponseDto.ok(event, '更新成功');
  }

  /**
   * 删除活动
   * 仅创建者可操作
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除活动' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '活动 ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async delete(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<null>> {
    await this.eventService.delete(id, req.user.sub);
    return ApiResponseDto.ok(null, '删除成功');
  }

  // ==================== 门票管理接口 ====================

  /**
   * 获取活动的所有门票
   * 无需登录
   */
  @Get(':id/tickets')
  @ApiOperation({ summary: '获取活动门票列表' })
  @ApiParam({ name: 'id', description: '活动 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async getTickets(
    @Param('id') id: string,
  ): Promise<ApiResponseDto<EventTicketEntity[]>> {
    const tickets = await this.eventService.getTickets(id);
    return ApiResponseDto.ok(tickets);
  }

  /**
   * 创建门票
   * 仅创建者可操作
   */
  @Post(':id/tickets')
  @ApiOperation({ summary: '创建门票' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '活动 ID' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async createTicket(
    @Param('id') id: string,
    @Body() dto: CreateTicketDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<EventTicketEntity>> {
    const ticket = await this.eventService.createTicket(id, dto, req.user.sub);
    return ApiResponseDto.created(ticket, '创建成功');
  }

  /**
   * 更新门票
   * 仅创建者可操作
   */
  @Patch(':eventId/tickets/:ticketId')
  @ApiOperation({ summary: '更新门票' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'eventId', description: '活动 ID' })
  @ApiParam({ name: 'ticketId', description: '门票 ID' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 400, description: '数量不能小于已售数量' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '活动或门票不存在' })
  async updateTicket(
    @Param('eventId') eventId: string,
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateTicketDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<EventTicketEntity>> {
    const ticket = await this.eventService.updateTicket(
      eventId,
      ticketId,
      dto,
      req.user.sub,
    );
    return ApiResponseDto.ok(ticket, '更新成功');
  }

  /**
   * 删除门票
   * 仅创建者可操作，已售出则不可删除
   */
  @Delete(':eventId/tickets/:ticketId')
  @ApiOperation({ summary: '删除门票' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'eventId', description: '活动 ID' })
  @ApiParam({ name: 'ticketId', description: '门票 ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 400, description: '已售出无法删除' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '活动或门票不存在' })
  async deleteTicket(
    @Param('eventId') eventId: string,
    @Param('ticketId') ticketId: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<null>> {
    await this.eventService.deleteTicket(eventId, ticketId, req.user.sub);
    return ApiResponseDto.ok(null, '删除成功');
  }
}

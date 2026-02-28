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
import {
  CreateEventDto,
  UpdateEventDto,
  QueryEventDto,
  MyEventsQueryDto,
} from './event.dto.js';
import { CreateTicketDto, UpdateTicketDto } from './ticket.dto.js';
import { EventTicketEntity } from './event-ticket.entity.js';
import { EventCoHostEntity } from './event-co-host.entity.js';
import { UserEntity } from '../user/user.entity.js';
import { AmapService } from '../../shared/services/amap.service.js';
import {
  SearchLocationDto,
  GeocodeDto,
  ReverseGeocodeDto,
} from './dto/location.dto.js';
import { ManageCoHostDto } from './dto/co-host.dto.js';

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

  // ==================== 我的活动列表接口 ====================

  /**
   * 获取我创建的活动列表
   * 需要登录，支持状态筛选和分页
   */
  @Get('my/created')
  @ApiOperation({ summary: '获取我创建的活动列表' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: '查询成功' })
  async getMyCreatedEvents(
    @Query() query: MyEventsQueryDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<{ items: EventEntity[]; total: number }>> {
    const result = await this.eventService.getMyCreatedEvents(
      req.user.sub,
      query,
    );
    return ApiResponseDto.ok(result);
  }

  /**
   * 获取我报名的活动列表
   * 需要登录，支持状态筛选和分页
   * 注意：依赖报名模块（Task 14），当前返回空列表
   */
  @Get('my/registered')
  @ApiOperation({ summary: '获取我报名的活动列表' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: '查询成功' })
  getMyRegisteredEvents(
    @Query() query: MyEventsQueryDto,
    @Req() req: { user: JwtPayload },
  ): ApiResponseDto<{ items: EventEntity[]; total: number }> {
    const result = this.eventService.getMyRegisteredEvents(req.user.sub, query);
    return ApiResponseDto.ok(result);
  }

  // ==================== 分享与二维码接口 ====================

  /**
   * 生成活动分享链接
   * 创建者或协办人可操作
   */
  @Post(':id/share-link')
  @ApiOperation({ summary: '生成活动分享链接' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '活动 ID' })
  @ApiResponse({ status: 200, description: '生成成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async generateShareLink(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<{ shareUrl: string }>> {
    const result = await this.eventService.generateShareLink(id, req.user.sub);
    return ApiResponseDto.ok(result, '生成成功');
  }

  /**
   * 生成签到二维码
   * 创建者或协办人可操作，返回 base64 二维码图片
   */
  @Post(':id/check-in-qrcode')
  @ApiOperation({ summary: '生成签到二维码' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '活动 ID' })
  @ApiResponse({ status: 200, description: '生成成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async generateCheckInQrcode(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<{ qrcodeDataUrl: string; checkInUrl: string }>> {
    const result = await this.eventService.generateCheckInQrcode(
      id,
      req.user.sub,
    );
    return ApiResponseDto.ok(result, '生成成功');
  }

  /**
   * 生成邀请海报数据
   * 创建者或协办人可操作，返回海报所需的活动信息和二维码
   */
  @Post(':id/invite-poster')
  @ApiOperation({ summary: '生成邀请海报数据' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '活动 ID' })
  @ApiResponse({ status: 200, description: '生成成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async generateInvitePoster(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<unknown>> {
    const result = await this.eventService.generateInvitePoster(
      id,
      req.user.sub,
    );
    return ApiResponseDto.ok(result, '生成成功');
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

  // ==================== 协办人管理接口 ====================

  /**
   * 获取活动协办人列表
   * 仅创建者或协办人可查看
   */
  @Get(':id/co-hosts')
  @ApiOperation({ summary: '获取活动协办人列表' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '活动 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 403, description: '无权查看' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async getCoHosts(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<UserEntity[]>> {
    const users = await this.eventService.getCoHosts(id, req.user.sub);
    return ApiResponseDto.ok(users);
  }

  /**
   * 添加协办人
   * 仅活动创建者可添加，协办人可管理报名但不能删除/取消活动
   */
  @Post(':id/co-hosts')
  @ApiOperation({ summary: '添加协办人' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '活动 ID' })
  @ApiResponse({ status: 201, description: '添加成功' })
  @ApiResponse({
    status: 400,
    description: '不能添加创建者为协办人 / 已是协办人',
  })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '活动或用户不存在' })
  async addCoHost(
    @Param('id') id: string,
    @Body() dto: ManageCoHostDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<EventCoHostEntity>> {
    const coHost = await this.eventService.addCoHost(
      id,
      dto.userId,
      req.user.sub,
    );
    return ApiResponseDto.created(coHost, '添加成功');
  }

  /**
   * 移除协办人
   * 仅活动创建者可移除
   */
  @Delete(':id/co-hosts/:userId')
  @ApiOperation({ summary: '移除协办人' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '活动 ID' })
  @ApiParam({ name: 'userId', description: '协办人用户 ID' })
  @ApiResponse({ status: 200, description: '移除成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '活动或协办人不存在' })
  async removeCoHost(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<null>> {
    await this.eventService.removeCoHost(id, userId, req.user.sub);
    return ApiResponseDto.ok(null, '移除成功');
  }
}

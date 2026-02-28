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

@ApiTags('活动')
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

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
}

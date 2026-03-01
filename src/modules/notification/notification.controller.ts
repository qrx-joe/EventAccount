import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ApiResponseDto } from '../../common/dto/api-response.dto.js';
import { NotificationService } from './notification.service.js';
import { NotificationEntity } from './notification.entity.js';
import { QueryNotificationDto, BroadcastDto } from './notification.dto.js';
import { JwtPayload } from '../auth/auth.dto.js';

/**
 * 通知控制器
 * 处理站内通知的查询、标记已读和群发消息
 */
@ApiTags('通知')
@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * 获取未读通知数量
   * 需要登录
   */
  @Get('notifications/unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取未读通知数量' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getUnreadCount(
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<{ count: number }>> {
    const count = await this.notificationService.getUnreadCount(req.user.sub);
    return ApiResponseDto.ok({ count });
  }

  /**
   * 获取通知列表
   * 需要登录，支持类型和已读状态筛选
   */
  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取通知列表' })
  @ApiQuery({ name: 'type', required: false, description: '通知类型筛选' })
  @ApiQuery({
    name: 'isRead',
    required: false,
    description: '是否已读筛选',
  })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getNotifications(
    @Query() query: QueryNotificationDto,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<{ items: NotificationEntity[]; total: number }>> {
    const result = await this.notificationService.getNotifications(
      req.user.sub,
      query,
    );
    return ApiResponseDto.ok(result);
  }

  /**
   * 标记单条通知为已读
   * 需要登录，仅通知所属用户可操作
   */
  @Patch('notifications/:id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '标记通知为已读' })
  @ApiParam({ name: 'id', description: '通知 ID' })
  @ApiResponse({ status: 200, description: '标记成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '通知不存在' })
  async markAsRead(
    @Param('id') id: string,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<NotificationEntity>> {
    const notification = await this.notificationService.markAsRead(
      id,
      req.user.sub,
    );
    return ApiResponseDto.ok(notification);
  }

  /**
   * 标记所有通知为已读
   * 需要登录
   */
  @Post('notifications/read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '标记所有通知为已读' })
  @ApiResponse({ status: 200, description: '操作成功' })
  async markAllAsRead(
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<null>> {
    await this.notificationService.markAllAsRead(req.user.sub);
    return ApiResponseDto.ok(null, '已全部标记为已读');
  }

  /**
   * 群发消息给活动参与者
   * 需要登录，仅活动创建者可操作
   */
  @Post('events/:eventId/broadcast')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '群发消息给活动参与者' })
  @ApiParam({ name: 'eventId', description: '活动 ID' })
  @ApiResponse({ status: 201, description: '群发成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '活动不存在' })
  async broadcast(
    @Param('eventId') eventId: string,
    @Body() dto: BroadcastDto,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<{ notifiedCount: number }>> {
    const result = await this.notificationService.broadcast(
      eventId,
      req.user.sub,
      dto,
    );
    return ApiResponseDto.created(result);
  }
}

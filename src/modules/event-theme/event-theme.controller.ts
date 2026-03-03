import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto.js';
import { EventThemeService } from './event-theme.service.js';
import { EventThemeEntity } from './event-theme.entity.js';
import { QueryEventThemeDto } from './event-theme.dto.js';

@ApiTags('活动主题')
@Controller('event-themes')
export class EventThemeController {
  constructor(private readonly themeService: EventThemeService) {}

  /**
   * 获取所有启用的主题模板
   * 公开接口，无需登录
   */
  @Get()
  @ApiOperation({ summary: '获取活动主题列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findAll(
    @Query() query: QueryEventThemeDto,
  ): Promise<ApiResponseDto<EventThemeEntity[]>> {
    const themes = await this.themeService.findAll(query);
    return ApiResponseDto.ok(themes);
  }

  /**
   * 根据 slug 获取主题详情
   * 公开接口，无需登录
   */
  @Get(':slug')
  @ApiOperation({ summary: '获取主题详情' })
  @ApiParam({ name: 'slug', description: '主题标识' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '主题不存在' })
  async findBySlug(
    @Param('slug') slug: string,
  ): Promise<ApiResponseDto<EventThemeEntity>> {
    const theme = await this.themeService.findBySlug(slug);
    return ApiResponseDto.ok(theme);
  }
}

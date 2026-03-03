import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { JwtPayload } from '../auth/auth.dto.js';
import { ApiResponseDto } from '../../common/dto/api-response.dto.js';
import { TagService } from './tag.service.js';
import { TagEntity } from './tag.entity.js';
import { CreateTagDto, QueryTagDto } from './tag.dto.js';

@ApiTags('标签')
@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  /**
   * 获取热门标签
   * 静态路由放在动态路由之前
   */
  @Get('popular')
  @ApiOperation({ summary: '获取热门标签' })
  @ApiQuery({ name: 'limit', required: false, description: '返回数量' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findPopular(
    @Query('limit') limit?: number,
  ): Promise<ApiResponseDto<TagEntity[]>> {
    const tags = await this.tagService.findPopular(limit ? Number(limit) : 20);
    return ApiResponseDto.ok(tags);
  }

  /**
   * 获取标签列表
   * 支持按类型筛选、关键词搜索和分页，无需登录
   */
  @Get()
  @ApiOperation({ summary: '获取标签列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findAll(
    @Query() query: QueryTagDto,
  ): Promise<ApiResponseDto<{ items: TagEntity[]; total: number }>> {
    const result = await this.tagService.findAll(query);
    return ApiResponseDto.ok(result);
  }

  /**
   * 创建标签
   * 需要登录，来源自动设为 user
   */
  @Post()
  @ApiOperation({ summary: '创建标签' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 409, description: '标签已存在' })
  async create(
    @Body() dto: CreateTagDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<TagEntity>> {
    const tag = await this.tagService.create(dto, req.user.sub);
    return ApiResponseDto.created(tag, '创建成功');
  }
}

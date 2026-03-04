import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
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
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { JwtPayload } from '../auth/auth.dto.js';
import { ApiResponseDto } from '../../common/dto/api-response.dto.js';
import { SearchService } from './search.service.js';
import {
  SearchQueryDto,
  HotSearchQueryDto,
  SearchResultDto,
  SearchRecordResponseDto,
  HotItemDto,
} from './search.dto.js';

/**
 * 搜索控制器
 * 提供搜索、热门推荐、搜索历史等接口
 */
@ApiTags('搜索')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * 搜索活动和社区
   * 支持关键词搜索，可按类型筛选
   * 可选认证：登录用户会记录搜索历史
   */
  @Get()
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '搜索活动和社区' })
  @ApiResponse({ status: 200, description: '搜索成功' })
  async search(
    @Query() query: SearchQueryDto,
    @Req() req: { user?: { sub: string } },
  ): Promise<ApiResponseDto<SearchResultDto>> {
    const userId = req.user?.sub;
    const result = await this.searchService.search(query, userId);
    return ApiResponseDto.ok(result);
  }

  /**
   * 获取热门活动
   */
  @Get('hot-events')
  @ApiOperation({ summary: '获取热门活动' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getHotEvents(
    @Query() query: HotSearchQueryDto,
  ): Promise<ApiResponseDto<HotItemDto[]>> {
    const events = await this.searchService.getHotEvents(query);
    return ApiResponseDto.ok(events);
  }

  /**
   * 获取推荐社区
   */
  @Get('recommended-communities')
  @ApiOperation({ summary: '获取推荐社区' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getRecommendedCommunities(
    @Query() query: HotSearchQueryDto,
  ): Promise<ApiResponseDto<HotItemDto[]>> {
    const communities = await this.searchService.getRecommendedCommunities(query);
    return ApiResponseDto.ok(communities);
  }

  /**
   * 获取热门搜索关键词
   */
  @Get('hot-keywords')
  @ApiOperation({ summary: '获取热门搜索关键词' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiQuery({ name: 'limit', required: false, description: '数量限制' })
  async getHotKeywords(
    @Query('limit') limit: string = '10',
  ): Promise<ApiResponseDto<string[]>> {
    const keywords = await this.searchService.getHotKeywords(parseInt(limit, 10));
    return ApiResponseDto.ok(keywords);
  }

  /**
   * 获取用户搜索历史
   */
  @Get('history')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取用户搜索历史' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiQuery({ name: 'limit', required: false, description: '数量限制' })
  async getUserSearchHistory(
    @Req() req: { user: JwtPayload },
    @Query('limit') limit: string = '10',
  ): Promise<ApiResponseDto<SearchRecordResponseDto[]>> {
    const history = await this.searchService.getUserSearchHistory(
      req.user.sub,
      parseInt(limit, 10),
    );
    return ApiResponseDto.ok(history);
  }

  /**
   * 删除单条搜索记录
   */
  @Delete('history/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '删除搜索记录' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async deleteSearchRecord(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<null>> {
    await this.searchService.deleteSearchRecord(req.user.sub, id);
    return ApiResponseDto.ok(null);
  }

  /**
   * 清空用户搜索历史
   */
  @Delete('history')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '清空搜索历史' })
  @ApiResponse({ status: 200, description: '清空成功' })
  async clearUserSearchHistory(
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<null>> {
    await this.searchService.clearUserSearchHistory(req.user.sub);
    return ApiResponseDto.ok(null);
  }
}

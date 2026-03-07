import {
  Controller,
  Get,
  Post,
  Delete,
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
import { CategoryService } from './category.service.js';
import { CategoryEntity } from './category.entity.js';
import { QueryCategoryDto } from './category.dto.js';

@ApiTags('分类')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  /**
   * 获取分类列表
   * 无需登录，按排序权重升序
   */
  @Get()
  @ApiOperation({ summary: '获取分类列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findAll(
    @Query() query: QueryCategoryDto,
  ): Promise<ApiResponseDto<{ items: CategoryEntity[]; total: number }>> {
    const result = await this.categoryService.findAll(query);
    return ApiResponseDto.ok(result);
  }

  /**
   * 获取分类详情
   * 通过 slug 查询，无需登录
   */
  @Get(':slug')
  @ApiOperation({ summary: '获取分类详情' })
  @ApiParam({ name: 'slug', description: '分类 URL 标识' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '分类不存在' })
  async findBySlug(
    @Param('slug') slug: string,
  ): Promise<ApiResponseDto<CategoryEntity>> {
    const category = await this.categoryService.findBySlug(slug);
    return ApiResponseDto.ok(category);
  }

  /**
   * 查询当前用户是否已订阅指定分类
   * 需要登录
   */
  @Get(':id/subscription')
  @ApiOperation({ summary: '查询订阅状态' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '分类 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async checkSubscription(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<{ subscribed: boolean }>> {
    const subscribed = await this.categoryService.isSubscribed(
      id,
      req.user.sub,
    );
    return ApiResponseDto.ok({ subscribed });
  }

  /**
   * 订阅分类
   * 需要登录
   */
  @Post(':id/subscribe')
  @ApiOperation({ summary: '订阅分类' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '分类 ID' })
  @ApiResponse({ status: 200, description: '订阅成功' })
  @ApiResponse({ status: 409, description: '已订阅' })
  async subscribe(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<null>> {
    await this.categoryService.subscribe(id, req.user.sub);
    return ApiResponseDto.ok(null, '订阅成功');
  }

  /**
   * 取消订阅分类
   * 需要登录
   */
  @Delete(':id/subscribe')
  @ApiOperation({ summary: '取消订阅分类' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '分类 ID' })
  @ApiResponse({ status: 200, description: '取消订阅成功' })
  @ApiResponse({ status: 404, description: '未订阅' })
  async unsubscribe(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<null>> {
    await this.categoryService.unsubscribe(id, req.user.sub);
    return ApiResponseDto.ok(null, '取消订阅成功');
  }
}

import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
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
import { AdminCommunityService } from './admin-community.service';
import {
  AdminCommunityQueryDto,
  AdminCommunityDto,
  AdminUpdateCommunityDto,
  AdminToggleCommunityStatusDto,
} from './admin-community.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/user.entity';

/**
 * 管理员社区控制器
 * 路由前缀 /admin/communities，仅管理员可访问
 */
@ApiTags('管理端-社区')
@Controller('admin/communities')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminCommunityController {
  constructor(private readonly adminCommunityService: AdminCommunityService) {}

  /** 社区列表（分页 + 搜索 + 筛选） */
  @ApiOperation({ summary: '管理员-社区列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @Get()
  async findAll(
    @Query() query: AdminCommunityQueryDto,
  ): Promise<ApiResponseDto<PaginatedResult<AdminCommunityDto>>> {
    const result = await this.adminCommunityService.findAll(query);
    return ApiResponseDto.ok(result);
  }

  /** 社区详情 */
  @ApiOperation({ summary: '管理员-社区详情' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '社区不存在' })
  @ApiParam({ name: 'id', description: '社区 ID', type: String })
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<AdminCommunityDto>> {
    const community = await this.adminCommunityService.findOne(id);
    return ApiResponseDto.ok(community);
  }

  /** 更新社区信息（name、description、status） */
  @ApiOperation({ summary: '管理员-更新社区' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 404, description: '社区不存在' })
  @ApiParam({ name: 'id', description: '社区 ID', type: String })
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateCommunityDto,
  ): Promise<ApiResponseDto<AdminCommunityDto>> {
    const community = await this.adminCommunityService.update(id, dto);
    return ApiResponseDto.ok(community);
  }

  /** 启用/禁用社区 */
  @ApiOperation({ summary: '管理员-切换社区状态' })
  @ApiResponse({ status: 200, description: '操作成功' })
  @ApiResponse({ status: 404, description: '社区不存在' })
  @ApiParam({ name: 'id', description: '社区 ID', type: String })
  @Put(':id/status')
  async toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminToggleCommunityStatusDto,
  ): Promise<ApiResponseDto<AdminCommunityDto>> {
    const community = await this.adminCommunityService.toggleStatus(id, dto);
    return ApiResponseDto.ok(community);
  }

  /** 删除社区 */
  @ApiOperation({ summary: '管理员-删除社区' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '社区不存在' })
  @ApiParam({ name: 'id', description: '社区 ID', type: String })
  @Delete(':id')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<null>> {
    await this.adminCommunityService.delete(id);
    return ApiResponseDto.ok(null);
  }
}

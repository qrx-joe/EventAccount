import {
  Controller,
  Get,
  Put,
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
import { AdminUserService } from './admin-user.service';
import {
  AdminUserQueryDto,
  AdminUserDto,
  AdminUpdateUserDto,
  AdminToggleStatusDto,
} from './admin-user.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './user.entity';
import { JwtPayload } from '../auth/auth.dto';

/**
 * 管理员用户控制器
 * 路由前缀 /admin/users，仅管理员可访问
 */
@ApiTags('管理端-用户')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  /** 用户列表（分页 + 搜索 + 筛选） */
  @ApiOperation({ summary: '管理员-用户列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @Get()
  async findAll(
    @Query() query: AdminUserQueryDto,
  ): Promise<ApiResponseDto<PaginatedResult<AdminUserDto>>> {
    const result = await this.adminUserService.findAll(query);
    return ApiResponseDto.ok(result);
  }

  /** 用户详情 */
  @ApiOperation({ summary: '管理员-用户详情' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  @ApiParam({ name: 'id', description: '用户 ID', type: String })
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<AdminUserDto>> {
    const user = await this.adminUserService.findOne(id);
    return ApiResponseDto.ok(user);
  }

  /** 更新用户信息（nickname、role） */
  @ApiOperation({ summary: '管理员-更新用户' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 403, description: '不能修改自己' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  @ApiParam({ name: 'id', description: '用户 ID', type: String })
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<AdminUserDto>> {
    const user = await this.adminUserService.update(id, req.user.sub, dto);
    return ApiResponseDto.ok(user);
  }

  /** 启用/禁用用户 */
  @ApiOperation({ summary: '管理员-切换用户状态' })
  @ApiResponse({ status: 200, description: '操作成功' })
  @ApiResponse({ status: 403, description: '不能修改自己' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  @ApiParam({ name: 'id', description: '用户 ID', type: String })
  @Put(':id/status')
  async toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminToggleStatusDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<AdminUserDto>> {
    const user = await this.adminUserService.toggleStatus(
      id,
      req.user.sub,
      dto,
    );
    return ApiResponseDto.ok(user);
  }
}

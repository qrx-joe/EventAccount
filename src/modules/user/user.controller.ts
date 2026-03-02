import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Req,
  Query,
  UseGuards,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { UpdateUserDto, UserPublicDto, UserSelfDto } from './user.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import {
  PaginationQueryDto,
  PaginatedResult,
} from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.dto';

/**
 * 用户控制器
 * 提供用户列表查询、公开资料、单用户增删改（仅限本人）
 * 用户创建统一通过 POST /api/auth/register 完成
 * 账号安全变更（密码/手机/邮箱）走 UserAccountController（/users/me/*）
 */
@ApiTags('用户')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** 获取用户公开信息（无需登录） */
  @ApiOperation({ summary: '获取用户公开信息' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  @ApiParam({ name: 'id', description: '用户 ID（UUIDv7）', type: String })
  @Get(':id/profile')
  async getPublicProfile(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<UserPublicDto>> {
    const profile = await this.userService.getPublicProfile(id);
    return ApiResponseDto.ok(profile);
  }

  @ApiOperation({ summary: '查询所有用户（公开信息，分页）' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<ApiResponseDto<PaginatedResult<UserPublicDto>>> {
    const result = await this.userService.findAll(query);
    return ApiResponseDto.ok(result);
  }

  @ApiOperation({ summary: '查询单个用户（仅限本人）' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiResponse({ status: 403, description: '无权访问他人信息' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '用户 ID（UUIDv7）', type: String })
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<UserSelfDto>> {
    if (req.user.sub !== id) {
      throw new ForbiddenException('无权访问他人信息');
    }
    const user = await this.userService.findOneSafe(id);
    return ApiResponseDto.ok(user);
  }

  @ApiOperation({ summary: '更新用户（仅限本人）' })
  @ApiResponse({ status: 200, description: '更新成功', type: ApiResponseDto })
  @ApiResponse({ status: 403, description: '无权操作他人数据' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '用户 ID（UUIDv7）', type: String })
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<UserSelfDto>> {
    if (req.user.sub !== id) {
      throw new ForbiddenException('无权操作他人数据');
    }
    const entity = await this.userService.update(id, dto);
    return ApiResponseDto.ok(this.userService.toSelfDto(entity));
  }

  @ApiOperation({ summary: '删除用户（仅限本人）' })
  @ApiResponse({ status: 200, description: '删除成功', type: ApiResponseDto })
  @ApiResponse({ status: 403, description: '无权操作他人数据' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '用户 ID（UUIDv7）', type: String })
  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<null>> {
    if (req.user.sub !== id) {
      throw new ForbiddenException('无权操作他人数据');
    }
    await this.userService.remove(id);
    return ApiResponseDto.ok(null, '删除成功');
  }
}

import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { UpdateUserDto, UserPublicDto } from './user.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.dto';
import { UserEntity } from './user.entity';

/**
 * 用户控制器
 * 提供用户查询、更新、删除接口（需登录）
 * 用户创建统一通过 POST /api/auth/register 完成
 * GET /users/:id/profile 为公开接口，无需登录
 *
 * 路由声明顺序重要：静态路由（me）必须在动态参数路由（:id）之前，
 * 否则 "me" 会被 Express 当作 :id 参数匹配
 */
@ApiTags('用户')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** 获取当前登录用户信息 */
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiResponse({ status: 401, description: '未登录' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<UserEntity>> {
    const user = await this.userService.findOne(req.user.sub);
    return ApiResponseDto.ok(user);
  }

  /** 获取用户公开信息（无需登录） */
  @ApiOperation({ summary: '获取用户公开信息' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  @ApiParam({ name: 'id', description: '用户 ID（UUIDv7）', type: String })
  @Get(':id/profile')
  async getPublicProfile(
    @Param('id') id: string,
  ): Promise<ApiResponseDto<UserPublicDto>> {
    const profile = await this.userService.getPublicProfile(id);
    return ApiResponseDto.ok(profile);
  }

  @ApiOperation({ summary: '查询所有用户（公开信息）' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(): Promise<ApiResponseDto<UserPublicDto[]>> {
    const users = await this.userService.findAll();
    return ApiResponseDto.ok(users);
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
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<UserEntity>> {
    if (req.user.sub !== id) {
      throw new ForbiddenException('无权访问他人信息');
    }
    const user = await this.userService.findOne(id);
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
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<UserEntity>> {
    if (req.user.sub !== id) {
      throw new ForbiddenException('无权操作他人数据');
    }
    const user = await this.userService.update(id, dto);
    return ApiResponseDto.ok(user);
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
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<null>> {
    if (req.user.sub !== id) {
      throw new ForbiddenException('无权操作他人数据');
    }
    await this.userService.remove(id);
    return ApiResponseDto.ok(null, '删除成功');
  }
}

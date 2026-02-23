import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { UpdateUserDto } from './user.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.dto';

/**
 * 用户控制器
 * 提供用户查询、更新、删除接口（需登录）
 * 用户创建统一通过 POST /api/auth/register 完成
 */
@ApiTags('用户')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** 获取当前登录用户信息 */
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 401, description: '未登录' })
  @Get('me')
  async getMe(@Req() req: { user: JwtPayload }) {
    const user = await this.userService.findOne(req.user.sub);
    return ApiResponseDto.ok(user);
  }

  @ApiOperation({ summary: '查询所有用户' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @Get()
  async findAll() {
    const users = await this.userService.findAll();
    return ApiResponseDto.ok(users);
  }

  @ApiOperation({ summary: '查询单个用户' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.userService.findOne(id);
    return ApiResponseDto.ok(user);
  }

  @ApiOperation({ summary: '更新用户' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const user = await this.userService.update(id, dto);
    return ApiResponseDto.ok(user);
  }

  @ApiOperation({ summary: '删除用户' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.userService.remove(id);
    return ApiResponseDto.ok(null, '删除成功');
  }
}

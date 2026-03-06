import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
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
import { CommunityService } from './community.service.js';
import { CommunityEntity } from './community.entity.js';
import { CommunityMemberEntity } from './community-member.entity.js';
import { EventEntity } from '../event/event.entity.js';
import {
  CreateCommunityDto,
  UpdateCommunityDto,
  UpdateCommunitySettingsDto,
  QueryCommunityDto,
  MyCommunitiesQueryDto,
  AddCommunityMemberDto,
  UpdateCommunityMemberDto,
  JoinCommunityDto,
} from './community.dto.js';

@ApiTags('社区')
@Controller('communities')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  // ==================== 公开接口（无需登录） ====================

  /**
   * 获取社区列表
   * 支持关键词搜索和筛选
   */
  @Get()
  @ApiOperation({ summary: '获取社区列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findAll(
    @Query() query: QueryCommunityDto,
  ): Promise<ApiResponseDto<{ items: CommunityEntity[]; total: number }>> {
    const result = await this.communityService.findAll(query);
    return ApiResponseDto.ok(result);
  }

  /**
   * 获取社区详情
   */
  @Get(':id')
  @ApiOperation({ summary: '获取社区详情' })
  @ApiParam({ name: 'id', description: '社区 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '社区不存在' })
  async findById(
    @Param('id') id: string,
  ): Promise<ApiResponseDto<CommunityEntity>> {
    const community = await this.communityService.findById(id);
    return ApiResponseDto.ok(community);
  }

  /**
   * 获取社区成员列表
   */
  @Get(':id/members')
  @ApiOperation({ summary: '获取社区成员列表' })
  @ApiParam({ name: 'id', description: '社区 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getMembers(
    @Param('id') id: string,
  ): Promise<ApiResponseDto<CommunityMemberEntity[]>> {
    const members = await this.communityService.getMembers(id);
    return ApiResponseDto.ok(members);
  }

  /**
   * 获取社区即将举办的活动
   */
  @Get(':id/events/upcoming')
  @ApiOperation({ summary: '获取社区即将举办的活动' })
  @ApiParam({ name: 'id', description: '社区 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getUpcomingEvents(
    @Param('id') id: string,
  ): Promise<ApiResponseDto<EventEntity[]>> {
    const events = await this.communityService.getUpcomingEvents(id);
    return ApiResponseDto.ok(events);
  }

  /**
   * 获取社区往期活动
   */
  @Get(':id/events/past')
  @ApiOperation({ summary: '获取社区往期活动' })
  @ApiParam({ name: 'id', description: '社区 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getPastEvents(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<ApiResponseDto<{ items: EventEntity[]; total: number }>> {
    const result = await this.communityService.getPastEvents(id, page, limit);
    return ApiResponseDto.ok(result);
  }

  // ==================== 需要登录的接口 ====================

  /**
   * 创建社区
   */
  @Post()
  @ApiOperation({ summary: '创建社区' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 201, description: '创建成功' })
  async create(
    @Body() dto: CreateCommunityDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<CommunityEntity>> {
    const community = await this.communityService.create(dto, req.user.sub);
    return ApiResponseDto.created(community, '创建成功');
  }

  /**
   * 更新社区基本信息
   */
  @Patch(':id')
  @ApiOperation({ summary: '更新社区基本信息' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '社区 ID' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '社区不存在' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommunityDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<CommunityEntity>> {
    const community = await this.communityService.update(id, dto, req.user.sub);
    return ApiResponseDto.ok(community, '更新成功');
  }

  /**
   * 更新社区设置
   */
  @Patch(':id/settings')
  @ApiOperation({ summary: '更新社区设置' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '社区 ID' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '社区不存在' })
  async updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateCommunitySettingsDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<CommunityEntity>> {
    const community = await this.communityService.updateSettings(
      id,
      dto,
      req.user.sub,
    );
    return ApiResponseDto.ok(community, '更新成功');
  }

  /**
   * 删除社区
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除社区' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '社区 ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '社区不存在' })
  async delete(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<null>> {
    await this.communityService.delete(id, req.user.sub);
    return ApiResponseDto.ok(null, '删除成功');
  }

  // ==================== 我的社区接口 ====================

  /**
   * 获取我加入的社区列表
   */
  @Get('my/joined')
  @ApiOperation({ summary: '获取我加入的社区列表' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: '查询成功' })
  async getMyCommunities(
    @Query() query: MyCommunitiesQueryDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<{ items: CommunityEntity[]; total: number }>> {
    const result = await this.communityService.getMyCommunities(
      req.user.sub,
      query,
    );
    return ApiResponseDto.ok(result);
  }

  /**
   * 获取我创建的社区列表
   */
  @Get('my/created')
  @ApiOperation({ summary: '获取我创建的社区列表' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: '查询成功' })
  async getMyCreatedCommunities(
    @Query() query: MyCommunitiesQueryDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<{ items: CommunityEntity[]; total: number }>> {
    const result = await this.communityService.getMyCreatedCommunities(
      req.user.sub,
      query,
    );
    return ApiResponseDto.ok(result);
  }

  // ==================== 成员管理接口 ====================

  /**
   * 加入社区
   */
  @Post(':id/join')
  @ApiOperation({ summary: '加入社区' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '社区 ID' })
  @ApiResponse({ status: 201, description: '加入成功' })
  @ApiResponse({ status: 400, description: '已经是成员' })
  @ApiResponse({ status: 404, description: '社区不存在' })
  async join(
    @Param('id') id: string,
    @Body() dto: JoinCommunityDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<CommunityMemberEntity>> {
    const member = await this.communityService.join(id, dto, req.user.sub);
    return ApiResponseDto.created(member, '加入成功');
  }

  /**
   * 离开社区
   */
  @Post(':id/leave')
  @ApiOperation({ summary: '离开社区' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '社区 ID' })
  @ApiResponse({ status: 200, description: '离开成功' })
  @ApiResponse({ status: 400, description: '创建者不能离开社区' })
  @ApiResponse({ status: 404, description: '社区不存在' })
  async leave(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<null>> {
    await this.communityService.leave(id, req.user.sub);
    return ApiResponseDto.ok(null, '离开成功');
  }

  /**
   * 添加社区成员（管理员操作）
   */
  @Post(':id/members')
  @ApiOperation({ summary: '添加社区成员' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '社区 ID' })
  @ApiResponse({ status: 201, description: '添加成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '社区或用户不存在' })
  async addMember(
    @Param('id') id: string,
    @Body() dto: AddCommunityMemberDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<CommunityMemberEntity>> {
    const member = await this.communityService.addMember(id, dto, req.user.sub);
    return ApiResponseDto.created(member, '添加成功');
  }

  /**
   * 更新成员信息（管理员操作）
   */
  @Patch(':id/members/:memberId')
  @ApiOperation({ summary: '更新成员信息' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '社区 ID' })
  @ApiParam({ name: 'memberId', description: '成员 ID' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '成员不存在' })
  async updateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateCommunityMemberDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<CommunityMemberEntity>> {
    const member = await this.communityService.updateMember(
      id,
      memberId,
      dto,
      req.user.sub,
    );
    return ApiResponseDto.ok(member, '更新成功');
  }

  /**
   * 移除成员（管理员操作）
   */
  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: '移除社区成员' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '社区 ID' })
  @ApiParam({ name: 'memberId', description: '成员 ID' })
  @ApiResponse({ status: 200, description: '移除成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '成员不存在' })
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<null>> {
    await this.communityService.removeMember(id, memberId, req.user.sub);
    return ApiResponseDto.ok(null, '移除成功');
  }

  /**
   * 审核加入申请（管理员操作）
   */
  @Post(':id/members/:memberId/approve')
  @ApiOperation({ summary: '审核加入申请' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '社区 ID' })
  @ApiParam({ name: 'memberId', description: '成员 ID' })
  @ApiResponse({ status: 200, description: '审核成功' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '成员不存在' })
  async approveMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body('approve') approve: boolean,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<CommunityMemberEntity>> {
    const member = await this.communityService.approveMember(
      id,
      memberId,
      req.user.sub,
      approve,
    );
    return ApiResponseDto.ok(member, approve ? '审核通过' : '已拒绝申请');
  }
}

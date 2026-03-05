import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityEntity } from './community.entity.js';
import { CommunityMemberEntity } from './community-member.entity.js';
import { CommunityMemberRole, CommunityMemberStatus } from './community.dto.js';
import {
  CreateCommunityDto,
  UpdateCommunityDto,
  UpdateCommunitySettingsDto,
  QueryCommunityDto,
  JoinCommunityDto,
  AddCommunityMemberDto,
  UpdateCommunityMemberDto,
  CommunityStatus,
} from './community.dto.js';
import { EventEntity } from '../event/event.entity.js';

/**
 * 社区服务
 * 提供社区 CRUD、成员管理、权限检查等功能
 */
@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    @InjectRepository(CommunityEntity)
    private readonly communityRepository: Repository<CommunityEntity>,
    @InjectRepository(CommunityMemberEntity)
    private readonly memberRepository: Repository<CommunityMemberEntity>,
  ) {}

  /**
   * 创建社区
   */
  async create(dto: CreateCommunityDto, creatorId: string): Promise<CommunityEntity> {
    const { tagIds, ...communityData } = dto;

    const community = this.communityRepository.create({
      ...communityData,
      creatorId,
      status: CommunityStatus.ACTIVE,
      memberCount: 1,
    });

    // 关联标签（如果有）
    if (tagIds && tagIds.length > 0) {
      community.tags = tagIds.map((id) => ({ id }) as CommunityEntity['tags'][0]);
    }

    const saved = await this.communityRepository.save(community);

    // 创建者自动成为管理员
    const member = this.memberRepository.create({
      communityId: saved.id,
      userId: creatorId,
      role: CommunityMemberRole.ADMIN,
      status: CommunityMemberStatus.ACTIVE,
      joinedAt: new Date(),
    });
    await this.memberRepository.save(member);

    this.logger.log(`用户 ${creatorId} 创建社区 ${saved.id}`);
    return saved;
  }

  /**
   * 社区列表（分页 + 筛选）
   */
  async findAll(query: QueryCommunityDto): Promise<{ items: CommunityEntity[]; total: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.communityRepository
      .createQueryBuilder('community')
      .leftJoinAndSelect('community.creator', 'creator')
      .leftJoinAndSelect('community.tags', 'tags')
      .where('community.status = :status', { status: CommunityStatus.ACTIVE });

    if (query.keyword) {
      qb.andWhere('community.name ILIKE :keyword', { keyword: `%${query.keyword}%` });
    }

    if (query.visibility) {
      qb.andWhere('community.visibility = :visibility', { visibility: query.visibility });
    }

    qb.orderBy('community.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /**
   * 根据 ID 查询社区详情
   */
  async findById(id: string, userId?: string): Promise<CommunityEntity> {
    const community = await this.communityRepository.findOne({
      where: { id },
      relations: ['creator', 'tags'],
    });

    if (!community) {
      throw new NotFoundException('社区不存在');
    }

    // 如果社区已被禁用，只有创建者和管理员可以查看
    if (community.status === 'inactive') {
      if (!userId || (community.creatorId !== userId)) {
        throw new ForbiddenException('该社区已被禁用');
      }
    }

    // 如果是私密社区，检查用户是否有权限查看
    if (community.visibility === 'private' && userId) {
      const isMember = await this.isMember(id, userId);
      if (!isMember && community.creatorId !== userId) {
        throw new ForbiddenException('无权查看此社区');
      }
    }

    return community;
  }

  /**
   * 更新社区基本信息
   * 仅创建者和管理员可操作
   */
  async update(
    id: string,
    dto: UpdateCommunityDto,
    userId: string,
  ): Promise<CommunityEntity> {
    const community = await this.findById(id, userId);
    await this.assertAdmin(community, userId);

    const { tagIds, ...updateData } = dto;

    // 更新基本字段
    Object.assign(community, updateData);

    // 更新标签关联（如果有）
    if (tagIds !== undefined) {
      if (tagIds.length === 0) {
        community.tags = [];
      } else {
        community.tags = tagIds.map((id) => ({ id }) as CommunityEntity['tags'][0]);
      }
    }

    const saved = await this.communityRepository.save(community);
    this.logger.log(`用户 ${userId} 更新社区 ${id}`);
    return saved;
  }

  /**
   * 解散社区（软删除）
   * 仅创建者可操作
   */
  async disband(id: string, userId: string): Promise<void> {
    const community = await this.findById(id, userId);

    if (community.creatorId !== userId) {
      throw new ForbiddenException('只有创建者可以解散社区');
    }

    community.status = CommunityStatus.DISBANDED;
    await this.communityRepository.save(community);
    this.logger.log(`用户 ${userId} 解散社区 ${id}`);
  }

  /**
   * 加入社区
   */
  async join(
    communityId: string,
    dto: JoinCommunityDto,
    userId: string,
  ): Promise<CommunityMemberEntity> {
    const community = await this.findById(communityId, userId);

    // 检查社区是否被禁用
    if (community.status === 'inactive') {
      throw new ForbiddenException('该社区已被禁用，无法加入');
    }

    // 检查是否已在社区中
    const existing = await this.memberRepository.findOne({
      where: { communityId, userId },
    });

    if (existing) {
      throw new BadRequestException('您已经是该社区的成员');
    }

    // 创建成员记录
    const member = this.memberRepository.create({
      communityId,
      userId,
      role: CommunityMemberRole.MEMBER,
      status: community.requireApproval
        ? CommunityMemberStatus.INACTIVE
        : CommunityMemberStatus.ACTIVE,
      joinedAt: community.requireApproval ? null : new Date(),
      remark: dto.remark,
    });

    const saved = await this.memberRepository.save(member);

    // 更新成员数量
    if (!community.requireApproval) {
      await this.updateMemberCount(communityId);
    }

    this.logger.log(`用户 ${userId} 加入社区 ${communityId}`);
    return saved;
  }

  /**
   * 离开社区
   */
  async leave(communityId: string, userId: string): Promise<void> {
    const community = await this.findById(communityId, userId);

    // 创建者不能离开自己的社区
    if (community.creatorId === userId) {
      throw new BadRequestException('创建者不能离开社区，请转让或解散社区');
    }

    const member = await this.memberRepository.findOne({
      where: { communityId, userId },
    });

    if (!member) {
      throw new NotFoundException('您不是该社区的成员');
    }

    await this.memberRepository.remove(member);
    await this.updateMemberCount(communityId);
    this.logger.log(`用户 ${userId} 离开社区 ${communityId}`);
  }

  /**
   * 获取社区成员列表
   */
  async getMembers(
    communityId: string,
    userId?: string,
  ): Promise<CommunityMemberEntity[]> {
    // 检查用户是否有权限查看成员列表
    if (userId) {
      const community = await this.findById(communityId, userId);
      const isMember = await this.isMember(communityId, userId);
      if (!isMember && community.creatorId !== userId && community.visibility === 'private') {
        throw new ForbiddenException('无权查看成员列表');
      }
    }

    return this.memberRepository.find({
      where: { communityId },
      relations: ['user'],
      order: { joinedAt: 'DESC' },
    });
  }

  /**
   * 移除成员
   * 仅管理员可操作
   */
  async removeMember(
    communityId: string,
    memberId: string,
    operatorId: string,
  ): Promise<void> {
    const community = await this.findById(communityId, operatorId);
    await this.assertAdmin(community, operatorId);

    const member = await this.memberRepository.findOne({
      where: { id: memberId, communityId },
    });

    if (!member) {
      throw new NotFoundException('成员不存在');
    }

    // 不能移除创建者
    if (member.userId === community.creatorId) {
      throw new BadRequestException('不能移除社区创建者');
    }

    await this.memberRepository.remove(member);
    await this.updateMemberCount(communityId);
    this.logger.log(`用户 ${operatorId} 移除成员 ${memberId} 从社区 ${communityId}`);
  }

  /**
   * 审核加入申请
   * 仅管理员可操作
   */
  async approveMember(
    communityId: string,
    memberId: string,
    operatorId: string,
    approve: boolean,
  ): Promise<CommunityMemberEntity> {
    const community = await this.findById(communityId, operatorId);
    await this.assertAdmin(community, operatorId);

    const member = await this.memberRepository.findOne({
      where: { id: memberId, communityId },
    });

    if (!member) {
      throw new NotFoundException('成员不存在');
    }

    if (member.status !== CommunityMemberStatus.INACTIVE) {
      throw new BadRequestException('该成员不需要审核');
    }

    if (approve) {
      member.status = CommunityMemberStatus.ACTIVE;
      member.joinedAt = new Date();
      await this.updateMemberCount(communityId);
    } else {
      await this.memberRepository.remove(member);
    }

    this.logger.log(`用户 ${operatorId} ${approve ? '通过' : '拒绝'}成员 ${memberId} 加入社区 ${communityId}`);
    return member;
  }

  /**
   * 转让社区
   * 仅创建者可操作
   */
  async transfer(
    id: string,
    newCreatorId: string,
    userId: string,
  ): Promise<CommunityEntity> {
    const community = await this.findById(id, userId);

    if (community.creatorId !== userId) {
      throw new ForbiddenException('只有创建者可以转让社区');
    }

    // 检查新创建者是否是社区成员
    const isMember = await this.isMember(id, newCreatorId);
    if (!isMember) {
      throw new BadRequestException('新创建者必须是社区成员');
    }

    community.creatorId = newCreatorId;
    const saved = await this.communityRepository.save(community);
    this.logger.log(`用户 ${userId} 将社区 ${id} 转让给 ${newCreatorId}`);
    return saved;
  }

  /**
   * 获取我加入的社区
   */
  async getMyCommunities(
    userId: string,
    query?: { page?: number; pageSize?: number },
  ): Promise<{ items: CommunityEntity[]; total: number }> {
    const memberships = await this.memberRepository.find({
      where: { userId, status: CommunityMemberStatus.ACTIVE },
      relations: ['community', 'community.creator'],
    });

    const communities = memberships
      .map((m) => m.community)
      .filter((c) => c && c.status !== CommunityStatus.DISBANDED);

    return { items: communities, total: communities.length };
  }

  /**
   * 获取我创建的社区（别名）
   */
  async getMyCreatedCommunities(
    userId: string,
    query?: { page?: number; pageSize?: number },
  ): Promise<{ items: CommunityEntity[]; total: number }> {
    const communities = await this.getCreatedCommunities(userId);
    return { items: communities, total: communities.length };
  }

  /**
   * 获取我创建的社区
   */
  async getCreatedCommunities(userId: string): Promise<CommunityEntity[]> {
    return this.communityRepository.find({
      where: { creatorId: userId, status: CommunityStatus.ACTIVE },
      relations: ['creator'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 更新社区设置
   */
  async updateSettings(
    id: string,
    dto: UpdateCommunitySettingsDto,
    userId: string,
  ): Promise<CommunityEntity> {
    const community = await this.findById(id, userId);
    await this.assertAdmin(community, userId);

    Object.assign(community, dto);
    const saved = await this.communityRepository.save(community);
    this.logger.log(`用户 ${userId} 更新社区设置 ${id}`);
    return saved;
  }

  /**
   * 删除社区（硬删除，仅创建者）
   */
  async delete(id: string, userId: string): Promise<void> {
    const community = await this.findById(id, userId);

    if (community.creatorId !== userId) {
      throw new ForbiddenException('只有创建者可以删除社区');
    }

    await this.communityRepository.remove(community);
    this.logger.log(`用户 ${userId} 删除社区 ${id}`);
  }

  /**
   * 获取即将举办的活动
   */
  async getUpcomingEvents(communityId: string): Promise<EventEntity[]> {
    // 这里简化实现，实际应该注入 EventRepository
    return [];
  }

  /**
   * 获取往期活动
   */
  async getPastEvents(
    communityId: string,
    page: number,
    limit: number,
  ): Promise<{ items: EventEntity[]; total: number }> {
    // 这里简化实现，实际应该注入 EventRepository
    return { items: [], total: 0 };
  }

  /**
   * 添加成员（管理员操作）
   */
  async addMember(
    communityId: string,
    dto: AddCommunityMemberDto,
    operatorId: string,
  ): Promise<CommunityMemberEntity> {
    const community = await this.findById(communityId, operatorId);
    await this.assertAdmin(community, operatorId);

    // 检查是否已在社区中
    const existing = await this.memberRepository.findOne({
      where: { communityId, userId: dto.userId },
    });

    if (existing) {
      throw new BadRequestException('该用户已经是社区成员');
    }

    // 创建成员记录
    const member = this.memberRepository.create({
      communityId,
      userId: dto.userId,
      role: dto.role || CommunityMemberRole.MEMBER,
      status: CommunityMemberStatus.ACTIVE,
      joinedAt: new Date(),
      remark: dto.remark,
    });

    const saved = await this.memberRepository.save(member);
    await this.updateMemberCount(communityId);

    this.logger.log(`用户 ${operatorId} 添加成员 ${dto.userId} 到社区 ${communityId}`);
    return saved;
  }

  /**
   * 更新成员信息
   */
  async updateMember(
    communityId: string,
    memberId: string,
    dto: UpdateCommunityMemberDto,
    operatorId: string,
  ): Promise<CommunityMemberEntity> {
    const community = await this.findById(communityId, operatorId);
    await this.assertAdmin(community, operatorId);

    const member = await this.memberRepository.findOne({
      where: { id: memberId, communityId },
    });

    if (!member) {
      throw new NotFoundException('成员不存在');
    }

    if (dto.role !== undefined) {
      member.role = dto.role;
    }
    if (dto.status !== undefined) {
      member.status = dto.status;
    }

    const saved = await this.memberRepository.save(member);
    this.logger.log(`用户 ${operatorId} 更新成员 ${memberId} 信息`);
    return saved;
  }

  /**
   * 检查用户是否是社区成员
   */
  private async isMember(
    communityId: string,
    userId: string,
  ): Promise<boolean> {
    const member = await this.memberRepository.findOne({
      where: { communityId, userId, status: CommunityMemberStatus.ACTIVE },
    });
    return !!member;
  }

  /**
   * 更新成员数量
   */
  private async updateMemberCount(communityId: string): Promise<void> {
    const count = await this.memberRepository.count({
      where: { communityId, status: CommunityMemberStatus.ACTIVE },
    });
    await this.communityRepository.update(communityId, { memberCount: count });
  }

  /**
   * 断言用户是社区管理员
   */
  private async assertAdmin(
    community: CommunityEntity,
    userId: string,
  ): Promise<void> {
    if (community.creatorId === userId) {
      return;
    }

    const member = await this.memberRepository.findOne({
      where: {
        communityId: community.id,
        userId,
        role: CommunityMemberRole.ADMIN,
        status: CommunityMemberStatus.ACTIVE,
      },
    });

    if (!member) {
      throw new ForbiddenException('只有管理员可以执行此操作');
    }
  }
}

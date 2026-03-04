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
import { UserEntity } from '../user/user.entity.js';
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
  CommunityMemberRole,
  CommunityMemberStatus,
  CommunityStatus,
} from './community.dto.js';
import { generateId } from '../../shared/utils/id-generator.js';
import * as crypto from 'crypto';

/**
 * 社区服务
 * 提供社区 CRUD、成员管理、设置管理等功能
 */
@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    @InjectRepository(CommunityEntity)
    private readonly communityRepository: Repository<CommunityEntity>,
    @InjectRepository(CommunityMemberEntity)
    private readonly memberRepository: Repository<CommunityMemberEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
  ) {}

  // ==================== 社区 CRUD ====================

  /**
   * 创建社区
   * 创建者自动成为社区创建者
   */
  async create(
    dto: CreateCommunityDto,
    creatorId: string,
  ): Promise<CommunityEntity> {
    const { tagIds, ...communityData } = dto;

    // 创建社区
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

    // 创建者自动成为社区成员
    const member = this.memberRepository.create({
      communityId: saved.id,
      userId: creatorId,
      role: CommunityMemberRole.CREATOR,
      status: CommunityMemberStatus.ACTIVE,
      joinedAt: new Date(),
    });
    await this.memberRepository.save(member);

    this.logger.log(`创建社区：${saved.name} (${saved.id})`);
    return saved;
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

    // 更新标签关联（全量替换）
    if (tagIds !== undefined) {
      community.tags = tagIds.map(
        (tagId) => ({ id: tagId }) as CommunityEntity['tags'][0],
      );
    }

    return this.communityRepository.save(community);
  }

  /**
   * 更新社区设置
   * 仅创建者和管理员可操作
   */
  async updateSettings(
    id: string,
    dto: UpdateCommunitySettingsDto,
    userId: string,
  ): Promise<CommunityEntity> {
    this.logger.log(`更新社区设置: ${id}, 用户: ${userId}, DTO: ${JSON.stringify(dto)}`);
    
    const community = await this.findById(id, userId);
    await this.assertAdmin(community, userId);

    this.logger.log(`更新前 - allowMemberEvent: ${community.allowMemberEvent}, enableDiscussion: ${community.enableDiscussion}`);
    
    Object.assign(community, dto);
    
    this.logger.log(`更新后 - allowMemberEvent: ${community.allowMemberEvent}, enableDiscussion: ${community.enableDiscussion}`);

    // 如果启用了开发者功能，生成 API Key
    if (dto.webhookUrl && !community.apiKey) {
      community.apiKey = this.generateApiKey();
    }

    const saved = await this.communityRepository.save(community);
    this.logger.log(`保存成功: ${saved.id}`);
    return saved;
  }

  /**
   * 删除社区
   * 仅创建者可操作
   */
  async delete(id: string, userId: string): Promise<void> {
    const community = await this.findById(id, userId);
    this.assertCreator(community, userId);

    await this.communityRepository.remove(community);
    this.logger.log(`删除社区：${id}`);
  }

  /**
   * 查询社区列表
   * 支持关键词搜索、状态筛选和分页
   */
  async findAll(
    query: QueryCommunityDto,
    userId?: string,
  ): Promise<{ items: CommunityEntity[]; total: number }> {
    const { keyword, status, visibility, page = 1, pageSize = 20 } = query;

    const qb = this.communityRepository
      .createQueryBuilder('community')
      .leftJoin('community.creator', 'creator')
      .addSelect([
        'creator.id',
        'creator.nickname',
        'creator.avatar',
      ])
      .leftJoinAndSelect('community.tags', 'tags');

    // 默认只显示公开社区
    if (!userId) {
      qb.andWhere('community.visibility = :visibility', {
        visibility: 'public',
      });
    }

    if (status) {
      qb.andWhere('community.status = :status', { status });
    }

    if (visibility) {
      qb.andWhere('community.visibility = :visibility', { visibility });
    }

    if (keyword) {
      qb.andWhere('community.name LIKE :keyword', {
        keyword: `%${keyword}%`,
      });
    }

    qb.orderBy('community.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // ==================== 我的社区 ====================

  /**
   * 获取我加入的社区列表
   */
  async getMyCommunities(
    userId: string,
    query: MyCommunitiesQueryDto,
  ): Promise<{ items: CommunityEntity[]; total: number }> {
    const { role, page = 1, pageSize = 20 } = query;

    const qb = this.communityRepository
      .createQueryBuilder('community')
      .innerJoin('community.members', 'member', 'member.userId = :userId', {
        userId,
      })
      .leftJoin('community.creator', 'creator')
      .addSelect(['creator.id', 'creator.nickname', 'creator.avatar'])
      .leftJoinAndSelect('community.tags', 'tags')
      .addSelect('member.role', 'memberRole');

    if (role) {
      qb.andWhere('member.role = :role', { role });
    }

    qb.orderBy('member.joinedAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /**
   * 获取我创建的社区列表
   */
  async getMyCreatedCommunities(
    userId: string,
    query: MyCommunitiesQueryDto,
  ): Promise<{ items: CommunityEntity[]; total: number }> {
    const { page = 1, pageSize = 20 } = query;

    const qb = this.communityRepository
      .createQueryBuilder('community')
      .leftJoin('community.creator', 'creator')
      .addSelect(['creator.id', 'creator.nickname', 'creator.avatar'])
      .leftJoinAndSelect('community.tags', 'tags')
      .where('community.creatorId = :userId', { userId });

    qb.orderBy('community.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // ==================== 成员管理 ====================

  /**
   * 获取社区成员列表
   */
  async getMembers(
    communityId: string,
    userId?: string,
  ): Promise<CommunityMemberEntity[]> {
    const community = await this.findById(communityId, userId);

    // 私密社区需要是成员才能查看成员列表
    if (community.visibility === 'private' && userId) {
      const isMember = await this.isMember(communityId, userId);
      if (!isMember && community.creatorId !== userId) {
        throw new ForbiddenException('无权查看成员列表');
      }
    }

    return this.memberRepository.find({
      where: { communityId },
      relations: ['user'],
      order: {
        role: 'ASC',
        joinedAt: 'DESC',
      },
    });
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
   * 添加成员（管理员操作）
   */
  async addMember(
    communityId: string,
    dto: AddCommunityMemberDto,
    operatorId: string,
  ): Promise<CommunityMemberEntity> {
    const community = await this.findById(communityId, operatorId);
    await this.assertAdmin(community, operatorId);

    // 检查目标用户是否存在
    const targetUser = await this.userRepository.findOne({
      where: { id: dto.userId },
    });
    if (!targetUser) {
      throw new NotFoundException('目标用户不存在');
    }

    // 检查是否已在社区中
    const existing = await this.memberRepository.findOne({
      where: { communityId, userId: dto.userId },
    });

    if (existing) {
      throw new BadRequestException('该用户已经是社区成员');
    }

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

    this.logger.log(`管理员 ${operatorId} 添加用户 ${dto.userId} 到社区 ${communityId}`);
    return saved;
  }

  /**
   * 更新成员信息（管理员操作）
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

    // 不能修改创建者角色
    if (member.role === CommunityMemberRole.CREATOR) {
      throw new ForbiddenException('不能修改创建者角色');
    }

    Object.assign(member, dto);
    return this.memberRepository.save(member);
  }

  /**
   * 移除成员（管理员操作）
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
    if (member.role === CommunityMemberRole.CREATOR) {
      throw new ForbiddenException('不能移除创建者');
    }

    await this.memberRepository.remove(member);
    await this.updateMemberCount(communityId);

    this.logger.log(`管理员 ${operatorId} 移除成员 ${memberId} 从社区 ${communityId}`);
  }

  /**
   * 审核加入申请（管理员操作）
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

    return this.memberRepository.save(member);
  }

  // ==================== 社区活动 ====================

  /**
   * 获取社区的即将举办的活动
   */
  async getUpcomingEvents(communityId: string): Promise<EventEntity[]> {
    await this.findById(communityId);

    const now = new Date();

    return this.eventRepository
      .createQueryBuilder('event')
      .where('event.communityId = :communityId', { communityId })
      .andWhere('event.status = :status', { status: 'published' })
      .andWhere('event.endTime > :now', { now })
      .leftJoin('event.creator', 'creator')
      .addSelect(['creator.id', 'creator.nickname', 'creator.avatar'])
      .leftJoinAndSelect('event.tickets', 'tickets')
      .orderBy('event.startTime', 'ASC')
      .getMany();
  }

  /**
   * 获取社区的往期活动
   */
  async getPastEvents(
    communityId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ items: EventEntity[]; total: number }> {
    await this.findById(communityId);

    const qb = this.eventRepository
      .createQueryBuilder('event')
      .where('event.communityId = :communityId', { communityId })
      .andWhere('event.status IN (:...statuses)', {
        statuses: ['completed', 'cancelled'],
      })
      .leftJoin('event.creator', 'creator')
      .addSelect(['creator.id', 'creator.nickname', 'creator.avatar'])
      .leftJoinAndSelect('event.tags', 'tags')
      .orderBy('event.endTime', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // ==================== 私有方法 ====================

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
   * 更新社区成员数量
   */
  private async updateMemberCount(communityId: string): Promise<void> {
    const count = await this.memberRepository.count({
      where: { communityId, status: CommunityMemberStatus.ACTIVE },
    });

    await this.communityRepository.update(communityId, { memberCount: count });
  }

  /**
   * 校验当前用户是否为社区创建者
   */
  private assertCreator(community: CommunityEntity, userId: string): void {
    if (community.creatorId !== userId) {
      throw new ForbiddenException('无权操作，仅创建者可执行此操作');
    }
  }

  /**
   * 校验当前用户是否为社区管理员（创建者或管理员）
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
      throw new ForbiddenException('无权操作，需要管理员权限');
    }
  }

  /**
   * 生成 API Key
   */
  private generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityEntity } from './community.entity';
import {
  AdminCommunityQueryDto,
  AdminCommunityDto,
  AdminUpdateCommunityDto,
  AdminToggleCommunityStatusDto,
  AdminCommunityStatus,
} from './admin-community.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';

/**
 * 管理员社区服务
 * 与 CommunityService 分离，专注管理端查询/更新逻辑
 */
@Injectable()
export class AdminCommunityService {
  private readonly logger = new Logger(AdminCommunityService.name);

  constructor(
    @InjectRepository(CommunityEntity)
    private readonly communityRepo: Repository<CommunityEntity>,
  ) {}

  /** 管理员社区列表（分页 + 搜索 + 筛选） */
  async findAll(
    query: AdminCommunityQueryDto,
  ): Promise<PaginatedResult<AdminCommunityDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.communityRepo
      .createQueryBuilder('c')
      .leftJoin('c.creator', 'creator')
      .addSelect([
        'creator.id',
        'creator.nickname',
        'creator.avatar',
      ])
      .where('c.status != :disbanded', { disbanded: 'disbanded' }); // 排除已解散的社区

    if (query.search) {
      const escaped = query.search.replace(/[%_\\]/g, '\\$&');
      qb.andWhere('c.name ILIKE :search', { search: `%${escaped}%` });
    }

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }

    qb.orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return new PaginatedResult(items as AdminCommunityDto[], total, page, pageSize);
  }

  /** 管理员查看社区详情 */
  async findOne(id: string): Promise<AdminCommunityDto> {
    const community = await this.communityRepo.findOne({
      where: { id },
      relations: ['creator'],
    });

    if (!community) {
      throw new NotFoundException(`社区 ${id} 不存在`);
    }

    // 已解散的社区管理员也能查看
    return community as AdminCommunityDto;
  }

  /** 管理员更新社区信息（name、description、status） */
  async update(
    id: string,
    dto: AdminUpdateCommunityDto,
  ): Promise<AdminCommunityDto> {
    const community = await this.communityRepo.findOne({
      where: { id },
    });

    if (!community) {
      throw new NotFoundException(`社区 ${id} 不存在`);
    }

    if (dto.name !== undefined) community.name = dto.name;
    if (dto.description !== undefined) community.description = dto.description;
    if (dto.status !== undefined) community.status = dto.status;

    await this.communityRepo.save(community);
    this.logger.log(`管理员更新社区: ${id}`);
    return this.findOne(id);
  }

  /** 管理员切换社区状态（启用/禁用） */
  async toggleStatus(
    id: string,
    dto: AdminToggleCommunityStatusDto,
  ): Promise<AdminCommunityDto> {
    const community = await this.communityRepo.findOne({
      where: { id },
    });

    if (!community) {
      throw new NotFoundException(`社区 ${id} 不存在`);
    }

    // 不能修改已解散社区的状态
    if (community.status === 'disbanded') {
      throw new NotFoundException('该社区已解散，无法修改状态');
    }

    community.status = dto.status;
    await this.communityRepo.save(community);
    this.logger.log(`管理员${dto.status === AdminCommunityStatus.ACTIVE ? '启用' : '禁用'}社区: ${id}`);
    return this.findOne(id);
  }

  /** 管理员删除社区（硬删除） */
  async delete(id: string): Promise<void> {
    const community = await this.communityRepo.findOne({
      where: { id },
    });

    if (!community) {
      throw new NotFoundException(`社区 ${id} 不存在`);
    }

    await this.communityRepo.remove(community);
    this.logger.log(`管理员删除社区: ${id}`);
  }
}

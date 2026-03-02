import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import {
  AdminUserQueryDto,
  AdminUserDto,
  AdminUpdateUserDto,
  AdminToggleStatusDto,
} from './admin-user.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';

/**
 * 管理员用户服务
 * 与 UserService 分离，专注管理端查询/更新逻辑
 */
@Injectable()
export class AdminUserService {
  private readonly logger = new Logger(AdminUserService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /** 管理员用户列表（分页 + 搜索 + 筛选） */
  async findAll(
    query: AdminUserQueryDto,
  ): Promise<PaginatedResult<AdminUserDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.userRepo
      .createQueryBuilder('u')
      .select([
        'u.id',
        'u.phone',
        'u.nickname',
        'u.email',
        'u.avatar',
        'u.bio',
        'u.role',
        'u.isActive',
        'u.createdAt',
        'u.updatedAt',
      ]);

    if (query.search) {
      const escaped = query.search.replace(/[%_\\]/g, '\\$&');
      qb.andWhere(
        '(u.nickname ILIKE :s OR u.phone ILIKE :s OR u.email ILIKE :s)',
        { s: `%${escaped}%` },
      );
    }
    if (query.role) {
      qb.andWhere('u.role = :role', { role: query.role });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('u.isActive = :active', { active: query.isActive });
    }

    qb.orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return new PaginatedResult(items, total, page, pageSize);
  }

  /** 管理员查看用户详情 */
  async findOne(id: string): Promise<AdminUserDto> {
    const user = await this.userRepo.findOne({
      where: { id },
      select: [
        'id',
        'phone',
        'nickname',
        'email',
        'avatar',
        'bio',
        'role',
        'isActive',
        'createdAt',
        'updatedAt',
      ],
    });
    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }
    return user;
  }

  /** 管理员更新用户信息（nickname、role） */
  async update(
    targetId: string,
    operatorId: string,
    dto: AdminUpdateUserDto,
  ): Promise<AdminUserDto> {
    if (targetId === operatorId) {
      throw new ForbiddenException('不能修改自己的信息');
    }

    const user = await this.userRepo.findOne({ where: { id: targetId } });
    if (!user) {
      throw new NotFoundException(`用户 ${targetId} 不存在`);
    }

    if (dto.nickname !== undefined) user.nickname = dto.nickname;
    if (dto.role !== undefined) user.role = dto.role;

    await this.userRepo.save(user);
    this.logger.log(`管理员更新用户: ${targetId}`);
    return this.findOne(targetId);
  }

  /** 管理员切换用户启用/禁用状态 */
  async toggleStatus(
    targetId: string,
    operatorId: string,
    dto: AdminToggleStatusDto,
  ): Promise<AdminUserDto> {
    if (targetId === operatorId) {
      throw new ForbiddenException('不能修改自己的状态');
    }

    const user = await this.userRepo.findOne({ where: { id: targetId } });
    if (!user) {
      throw new NotFoundException(`用户 ${targetId} 不存在`);
    }

    user.isActive = dto.isActive;
    await this.userRepo.save(user);
    this.logger.log(`管理员${dto.isActive ? '启用' : '禁用'}用户: ${targetId}`);
    return this.findOne(targetId);
  }
}

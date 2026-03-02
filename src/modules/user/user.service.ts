import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { PG_UNIQUE_VIOLATION } from '../../common/constants/postgres';
import { UserEntity } from './user.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  UserPublicDto,
  UserSelfDto,
} from './user.dto';
import {
  PaginationQueryDto,
  PaginatedResult,
} from '../../common/dto/pagination.dto';

/** bcrypt 哈希轮数（12 轮 ≈ 300ms，安全性与性能的平衡点） */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * 用户服务
 * 负责用户的增删改查业务逻辑
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  /** 邮箱规范化（去空格 + 转小写） */
  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /** 创建用户 */
  async create(dto: CreateUserDto): Promise<UserEntity> {
    // 检查手机号唯一性
    const existsByPhone = await this.userRepo.findOne({
      where: { phone: dto.phone },
    });
    if (existsByPhone) {
      throw new ConflictException('该手机号已注册');
    }

    // 检查邮箱唯一性（如果提供了邮箱）
    if (dto.email) {
      const normalizedEmail = this.normalizeEmail(dto.email);
      const existsByEmail = await this.userRepo.findOne({
        where: { email: normalizedEmail },
      });
      if (existsByEmail) {
        throw new ConflictException('该邮箱已被使用');
      }
      dto.email = normalizedEmail;
    }

    // 未传昵称时自动生成默认值
    const nickname = dto.nickname ?? `用户${dto.phone.slice(-4)}`;

    // 密码哈希
    const hashed = dto.password
      ? await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS)
      : null;

    const user = this.userRepo.create({
      ...dto,
      nickname,
      password: hashed,
    });

    // 兜底捕获数据库唯一约束冲突（防止 findOne 检查与 save 写入之间的竞态窗口）
    let saved: UserEntity;
    try {
      saved = await this.userRepo.save(user);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code?: string }).code ===
          PG_UNIQUE_VIOLATION
      ) {
        throw new ConflictException('该手机号或邮箱已被使用');
      }
      throw err;
    }
    this.logger.log(`用户创建成功: ${saved.id}`);
    return saved;
  }

  /** 查询所有用户（仅公开字段，支持分页） */
  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<UserPublicDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [items, total] = await this.userRepo.findAndCount({
      select: ['id', 'nickname', 'avatar', 'bio', 'createdAt'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return new PaginatedResult(items, total, page, pageSize);
  }

  /** 根据 ID 查询用户 */
  async findOne(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }
    return user;
  }

  /** Entity → DTO 映射，显式摘取安全字段，防止新增 Entity 字段意外暴露 */
  toSelfDto(user: UserEntity): UserSelfDto {
    return {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /** 根据 ID 查询用户并返回安全 DTO（供 Controller / 其他 Service 使用） */
  async findOneSafe(id: string): Promise<UserSelfDto> {
    return this.toSelfDto(await this.findOne(id));
  }

  /** 根据手机号查询用户 */
  async findByPhone(phone: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { phone } });
  }

  /** 根据邮箱查询用户 */
  async findByEmail(email: string): Promise<UserEntity | null> {
    const normalizedEmail = this.normalizeEmail(email);
    return this.userRepo.findOne({ where: { email: normalizedEmail } });
  }

  /** 获取用户公开信息（不含敏感字段） */
  async getPublicProfile(id: string): Promise<UserPublicDto> {
    const user = await this.userRepo.findOne({
      where: { id },
      select: ['id', 'nickname', 'avatar', 'bio', 'createdAt'],
    });
    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }
    return user;
  }

  /** 更新用户（仅允许昵称、头像、签名；邮箱变更走 PUT /me/email） */
  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findOne(id);
    // 逐字段赋值，避免 undefined 覆盖已有值
    if (dto.nickname !== undefined) user.nickname = dto.nickname;
    if (dto.avatar !== undefined) user.avatar = dto.avatar;
    if (dto.bio !== undefined) user.bio = dto.bio;
    return this.userRepo.save(user);
  }

  /** 删除用户 */
  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepo.remove(user);
    this.logger.log(`用户删除成功: ${id}`);
  }

  /** 根据手机号查询用户（含密码字段，仅供 AuthService 登录校验使用） */
  async findByPhoneWithPassword(phone: string): Promise<UserEntity | null> {
    return this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.phone = :phone', { phone })
      .getOne();
  }

  /** 根据 ID 查询用户（含密码字段，仅供 AuthService 重置密码校验使用） */
  async findByIdWithPassword(id: string): Promise<UserEntity | null> {
    return this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.id = :id', { id })
      .getOne();
  }

  /** 更新用户密码 */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hashed = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await this.userRepo.update(userId, { password: hashed });
    this.logger.log(`用户密码更新成功: ${userId}`);
  }

  /** 更新用户基础字段（内部复用） */
  async updateBasicFields(
    userId: string,
    fields: Partial<Pick<UserEntity, 'phone' | 'email'>>,
  ): Promise<void> {
    await this.userRepo.update(userId, fields);
  }
}

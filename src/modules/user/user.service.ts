import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import { CreateUserDto, UpdateUserDto } from './user.dto';

/**
 * 用户服务
 * 负责用户的增删改查业务逻辑
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

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
      const existsByEmail = await this.userRepo.findOne({
        where: { email: dto.email },
      });
      if (existsByEmail) {
        throw new ConflictException('该邮箱已被使用');
      }
    }

    // 未传昵称时自动生成默认值
    const nickname = dto.nickname ?? `用户${dto.phone.slice(-4)}`;

    const user = this.userRepo.create({
      ...dto,
      nickname,
    });
    const saved = await this.userRepo.save(user);
    this.logger.log(`用户创建成功: ${saved.id}`);
    return saved;
  }

  /** 查询所有用户 */
  async findAll(): Promise<UserEntity[]> {
    return this.userRepo.find({ order: { createdAt: 'DESC' } });
  }

  /** 根据 ID 查询用户 */
  async findOne(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }
    return user;
  }

  /** 根据手机号查询用户 */
  async findByPhone(phone: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { phone } });
  }

  /** 更新用户 */
  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  /** 删除用户 */
  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepo.remove(user);
    this.logger.log(`用户删除成功: ${id}`);
  }
}

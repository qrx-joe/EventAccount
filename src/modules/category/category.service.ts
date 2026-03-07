import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { CategoryEntity } from './category.entity.js';
import { CategorySubscriberEntity } from './category-subscriber.entity.js';
import { QueryCategoryDto } from './category.dto.js';

/**
 * 分类服务
 * 提供分类查询和订阅管理
 */
@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepository: Repository<CategoryEntity>,
    @InjectRepository(CategorySubscriberEntity)
    private readonly subscriberRepository: Repository<CategorySubscriberEntity>,
  ) {}

  /**
   * 查询分类列表
   * 按 sortOrder 升序排列，支持关键词搜索和分页
   */
  async findAll(
    query: QueryCategoryDto,
  ): Promise<{ items: CategoryEntity[]; total: number }> {
    const { keyword, page = 1, limit = 20 } = query;

    const where: Record<string, unknown> = {};
    if (keyword) {
      where.name = Like(`%${keyword}%`);
    }

    const [items, total] = await this.categoryRepository.findAndCount({
      where,
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total };
  }

  /**
   * 根据 slug 查询分类详情
   */
  async findBySlug(slug: string): Promise<CategoryEntity> {
    const category = await this.categoryRepository.findOne({ where: { slug } });
    if (!category) {
      throw new NotFoundException(`分类不存在: ${slug}`);
    }
    return category;
  }

  /**
   * 查询用户是否已订阅指定分类
   */
  async isSubscribed(categoryId: string, userId: string): Promise<boolean> {
    const count = await this.subscriberRepository.count({
      where: { categoryId, userId },
    });
    return count > 0;
  }

  /**
   * 订阅分类
   * 订阅后自动更新 subscriber_count
   */
  async subscribe(categoryId: string, userId: string): Promise<void> {
    // 检查分类是否存在
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException('分类不存在');
    }

    // 检查是否已订阅
    const existing = await this.subscriberRepository.findOne({
      where: { categoryId, userId },
    });
    if (existing) {
      throw new ConflictException('已订阅该分类');
    }

    // 创建订阅记录
    const subscriber = this.subscriberRepository.create({ categoryId, userId });
    await this.subscriberRepository.save(subscriber);

    // 更新订阅者计数
    await this.categoryRepository.increment(
      { id: categoryId },
      'subscriberCount',
      1,
    );
  }

  /**
   * 取消订阅分类
   * 取消后自动更新 subscriber_count
   */
  async unsubscribe(categoryId: string, userId: string): Promise<void> {
    const subscriber = await this.subscriberRepository.findOne({
      where: { categoryId, userId },
    });
    if (!subscriber) {
      throw new NotFoundException('未订阅该分类');
    }

    await this.subscriberRepository.remove(subscriber);

    // 更新订阅者计数（确保不小于 0）
    await this.categoryRepository
      .createQueryBuilder()
      .update()
      .set({
        subscriberCount: () => 'GREATEST("subscriberCount" - 1, 0)',
      })
      .where('id = :id', { id: categoryId })
      .execute();
  }
}

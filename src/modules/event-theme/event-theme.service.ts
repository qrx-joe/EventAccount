import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { EventThemeEntity } from './event-theme.entity.js';
import { QueryEventThemeDto } from './event-theme.dto.js';

/**
 * 活动主题服务
 * 提供主题模板查询，仅返回启用状态的主题
 */
@Injectable()
export class EventThemeService {
  constructor(
    @InjectRepository(EventThemeEntity)
    private readonly themeRepository: Repository<EventThemeEntity>,
  ) {}

  /**
   * 获取所有启用的主题模板
   * 按 sortOrder 升序排列，支持外观模式筛选
   */
  async findAll(query: QueryEventThemeDto): Promise<EventThemeEntity[]> {
    const where: FindOptionsWhere<EventThemeEntity> = { isActive: true };

    if (query.appearance) {
      where.appearance = query.appearance;
    }

    return this.themeRepository.find({
      where,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * 根据 slug 查询主题详情
   * 仅返回启用状态的主题
   */
  async findBySlug(slug: string): Promise<EventThemeEntity> {
    const theme = await this.themeRepository.findOne({
      where: { slug, isActive: true },
    });

    if (!theme) {
      throw new NotFoundException('主题不存在');
    }

    return theme;
  }
}

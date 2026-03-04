import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, MoreThan } from 'typeorm';
import { SearchRecordEntity } from './search.entity.js';
import { EventEntity } from '../event/event.entity.js';
import { CommunityEntity } from '../community/community.entity.js';
import {
  SearchQueryDto,
  HotSearchQueryDto,
  SearchResultDto,
  SearchResultItemDto,
  HotItemDto,
} from './search.dto.js';

/**
 * 搜索服务
 * 提供活动、社区搜索，热门推荐，搜索历史等功能
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(SearchRecordEntity)
    private readonly searchRecordRepository: Repository<SearchRecordEntity>,
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(CommunityEntity)
    private readonly communityRepository: Repository<CommunityEntity>,
  ) {}

  /**
   * 搜索活动和社区
   * 根据关键词搜索活动名称、社区名称
   */
  async search(
    dto: SearchQueryDto,
    userId?: string,
  ): Promise<SearchResultDto> {
    const { keyword, type, page = 1, pageSize = 20 } = dto;
    const skip = (page - 1) * pageSize;

    let events: SearchResultItemDto[] = [];
    let communities: SearchResultItemDto[] = [];

    // 搜索活动 - 多字段模糊搜索
    if (type === 'all' || type === 'event') {
      const eventResults = await this.eventRepository
        .createQueryBuilder('event')
        .where(
          '(event.title LIKE :keyword OR event.description LIKE :keyword OR event.locationName LIKE :keyword OR event.locationAddress LIKE :keyword)',
          { keyword: `%${keyword}%` }
        )
        .andWhere('event.status = :status', { status: 'published' })
        .leftJoin('event.creator', 'creator')
        .addSelect(['creator.id', 'creator.nickname', 'creator.avatar'])
        .orderBy('event.startTime', 'ASC')
        .skip(type === 'all' ? 0 : skip)
        .take(type === 'all' ? 10 : pageSize)
        .getMany();

      events = eventResults.map((event) => ({
        id: event.id,
        type: 'event' as const,
        title: event.title,
        description: event.description,
        coverImage: event.coverImage,
        startTime: event.startTime,
        locationName: event.locationName ?? undefined,
        creator: {
          id: event.creator.id,
          nickname: event.creator.nickname,
          avatar: event.creator.avatar,
        },
      }));
    }

    // 搜索社区 - 多字段模糊搜索
    if (type === 'all' || type === 'community') {
      const communityResults = await this.communityRepository
        .createQueryBuilder('community')
        .where(
          '(community.name LIKE :keyword OR community.description LIKE :keyword)',
          { keyword: `%${keyword}%` }
        )
        .andWhere('community.status = :status', { status: 'active' })
        .leftJoin('community.creator', 'creator')
        .addSelect(['creator.id', 'creator.nickname', 'creator.avatar'])
        .orderBy('community.memberCount', 'DESC')
        .skip(type === 'all' ? 0 : skip)
        .take(type === 'all' ? 10 : pageSize)
        .getMany();

      communities = communityResults.map((community) => ({
        id: community.id,
        type: 'community' as const,
        title: community.name,
        description: community.description,
        coverImage: community.coverImage,
        memberCount: community.memberCount,
        creator: {
          id: community.creator.id,
          nickname: community.creator.nickname,
          avatar: community.creator.avatar,
        },
      }));
    }

    // 记录搜索历史
    if (userId) {
      await this.recordSearch(userId, keyword, type || 'all', events.length + communities.length);
    }

    const total = events.length + communities.length;

    this.logger.log(`搜索: "${keyword}", 类型: ${type}, 结果: ${total} 条`);

    return {
      events,
      communities,
      total,
      page: page!,
      pageSize: pageSize!,
    };
  }

  /**
   * 获取热门活动
   * 基于参与人数和即将开始的活动
   */
  async getHotEvents(query: HotSearchQueryDto): Promise<HotItemDto[]> {
    const { limit } = query;
    const now = new Date();

    const events = await this.eventRepository
      .createQueryBuilder('event')
      .where('event.status = :status', { status: 'published' })
      .andWhere('event.startTime > :now', { now })
      .leftJoin('event.creator', 'creator')
      .addSelect(['creator.id', 'creator.nickname', 'creator.avatar'])
      .orderBy('event.startTime', 'ASC')
      .take(limit)
      .getMany();

    return events.map((event) => ({
      id: event.id,
      title: event.title,
      coverImage: event.coverImage,
      startTime: event.startTime,
      creator: {
        id: event.creator.id,
        nickname: event.creator.nickname,
        avatar: event.creator.avatar,
      },
    }));
  }

  /**
   * 获取推荐社区
   * 基于成员数量和活跃度
   */
  async getRecommendedCommunities(query: HotSearchQueryDto): Promise<HotItemDto[]> {
    const { limit } = query;

    const communities = await this.communityRepository
      .createQueryBuilder('community')
      .where('community.status = :status', { status: 'active' })
      .andWhere('community.visibility = :visibility', { visibility: 'public' })
      .leftJoin('community.creator', 'creator')
      .addSelect(['creator.id', 'creator.nickname', 'creator.avatar'])
      .orderBy('community.memberCount', 'DESC')
      .take(limit)
      .getMany();

    return communities.map((community) => ({
      id: community.id,
      title: community.name,
      coverImage: community.coverImage,
      memberCount: community.memberCount,
      creator: {
        id: community.creator.id,
        nickname: community.creator.nickname,
        avatar: community.creator.avatar,
      },
    }));
  }

  /**
   * 获取用户搜索历史
   */
  async getUserSearchHistory(userId: string, limit: number = 10): Promise<SearchRecordEntity[]> {
    return this.searchRecordRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 获取热门搜索关键词
   */
  async getHotKeywords(limit: number = 10): Promise<string[]> {
    const results = await this.searchRecordRepository
      .createQueryBuilder('record')
      .select('record.keyword', 'keyword')
      .addSelect('COUNT(record.keyword)', 'count')
      .where('record.createdAt > :date', {
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 最近7天
      })
      .groupBy('record.keyword')
      .orderBy('count', 'DESC')
      .take(limit)
      .getRawMany();

    return results.map((item) => item.keyword);
  }

  /**
   * 删除搜索记录
   */
  async deleteSearchRecord(userId: string, recordId: string): Promise<void> {
    await this.searchRecordRepository.delete({
      id: recordId,
      userId,
    });
    this.logger.log(`删除搜索记录: ${recordId}`);
  }

  /**
   * 清空用户搜索历史
   */
  async clearUserSearchHistory(userId: string): Promise<void> {
    await this.searchRecordRepository.delete({ userId });
    this.logger.log(`清空用户搜索历史: ${userId}`);
  }

  /**
   * 记录搜索历史
   */
  private async recordSearch(
    userId: string,
    keyword: string,
    type: string,
    resultCount: number,
  ): Promise<void> {
    // 检查是否已有相同关键词的搜索记录（24小时内）
    const existingRecord = await this.searchRecordRepository.findOne({
      where: {
        userId,
        keyword,
        createdAt: MoreThan(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      },
    });

    if (existingRecord) {
      // 更新现有记录
      existingRecord.resultCount = resultCount;
      existingRecord.createdAt = new Date();
      await this.searchRecordRepository.save(existingRecord);
    } else {
      // 创建新记录
      const record = this.searchRecordRepository.create({
        userId,
        keyword,
        type,
        resultCount,
      });
      await this.searchRecordRepository.save(record);
    }
  }
}

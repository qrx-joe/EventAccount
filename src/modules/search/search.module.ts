import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';
import { SearchRecordEntity } from './search.entity.js';
import { EventEntity } from '../event/event.entity.js';
import { CommunityEntity } from '../community/community.entity.js';

/**
 * 搜索模块
 * 提供搜索、热门推荐、搜索历史等功能
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SearchRecordEntity,
      EventEntity,
      CommunityEntity,
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}

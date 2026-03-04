import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsIn,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 搜索请求 DTO
 */
export class SearchQueryDto {
  @ApiProperty({ description: '搜索关键词' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  keyword: string;

  @ApiPropertyOptional({
    description: '搜索类型',
    enum: ['all', 'event', 'community'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'event', 'community'])
  type?: string = 'all';

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}

/**
 * 热门搜索查询 DTO
 */
export class HotSearchQueryDto {
  @ApiPropertyOptional({ description: '数量限制', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

/**
 * 搜索记录响应 DTO
 */
export class SearchRecordResponseDto {
  id: string;
  userId: string;
  keyword: string;
  type: string;
  resultCount: number;
  createdAt: Date;
}

/**
 * 搜索结果项 DTO
 */
export class SearchResultItemDto {
  id: string;
  type: 'event' | 'community';
  title: string;
  description: string | null;
  coverImage: string | null;
  startTime?: Date;
  locationName?: string;
  memberCount?: number;
  creator: {
    id: string;
    nickname: string | null;
    avatar: string | null;
  };
}

/**
 * 搜索结果响应 DTO
 */
export class SearchResultDto {
  events: SearchResultItemDto[];
  communities: SearchResultItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 热门活动/社区响应 DTO
 */
export class HotItemDto {
  id: string;
  title: string;
  coverImage: string | null;
  startTime?: Date;
  memberCount?: number;
  creator: {
    id: string;
    nickname: string | null;
    avatar: string | null;
  };
}

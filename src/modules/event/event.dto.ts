import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsBoolean,
  IsInt,
  IsDateString,
  IsArray,
  IsObject,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 创建活动 DTO
 */
export class CreateEventDto {
  @ApiProperty({ description: '活动名称', example: 'AI 技术分享会' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: '活动描述（富文本）' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '海报 URL' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiProperty({ description: '开始时间', example: '2026-04-01T09:00:00Z' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ description: '结束时间', example: '2026-04-01T17:00:00Z' })
  @IsDateString()
  endTime: string;

  @ApiPropertyOptional({
    description: '时区',
    default: 'Asia/Shanghai',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({
    description: '地点类型',
    enum: ['offline', 'online'],
  })
  @IsIn(['offline', 'online'])
  locationType: string;

  @ApiPropertyOptional({ description: '地点名称' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  locationName?: string;

  @ApiPropertyOptional({ description: '详细地址' })
  @IsOptional()
  @IsString()
  locationAddress?: string;

  @ApiPropertyOptional({ description: '纬度' })
  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({ description: '经度' })
  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({ description: '线上链接' })
  @IsOptional()
  @IsString()
  onlineLink?: string;

  @ApiPropertyOptional({
    description: '可见性',
    enum: ['public', 'private'],
    default: 'public',
  })
  @IsOptional()
  @IsIn(['public', 'private'])
  visibility?: string;

  @ApiPropertyOptional({ description: '是否需要审核报名', default: false })
  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;

  @ApiPropertyOptional({ description: '人数限制（0=无限制）', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ description: '所属分类 ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: '活动主题配置' })
  @IsOptional()
  @IsObject()
  theme?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: '标签 ID 列表',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];
}

/**
 * 更新活动 DTO
 * 所有字段可选
 */
export class UpdateEventDto {
  @ApiPropertyOptional({ description: '活动名称' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: '活动描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '海报 URL' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ description: '开始时间' })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({ description: '结束时间' })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({ description: '时区' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: '地点类型',
    enum: ['offline', 'online'],
  })
  @IsOptional()
  @IsIn(['offline', 'online'])
  locationType?: string;

  @ApiPropertyOptional({ description: '地点名称' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  locationName?: string;

  @ApiPropertyOptional({ description: '详细地址' })
  @IsOptional()
  @IsString()
  locationAddress?: string;

  @ApiPropertyOptional({ description: '纬度' })
  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({ description: '经度' })
  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({ description: '线上链接' })
  @IsOptional()
  @IsString()
  onlineLink?: string;

  @ApiPropertyOptional({
    description: '可见性',
    enum: ['public', 'private'],
  })
  @IsOptional()
  @IsIn(['public', 'private'])
  visibility?: string;

  @ApiPropertyOptional({ description: '是否需要审核报名' })
  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;

  @ApiPropertyOptional({ description: '人数限制（0=无限制）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ description: '所属分类 ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: '活动主题配置' })
  @IsOptional()
  @IsObject()
  theme?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: '标签 ID 列表（全量替换）',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];
}

/**
 * 我的活动查询 DTO
 * 支持状态筛选和分页
 */
export class MyEventsQueryDto {
  @ApiPropertyOptional({
    description: '活动状态',
    enum: ['draft', 'published', 'cancelled', 'completed'],
  })
  @IsOptional()
  @IsIn(['draft', 'published', 'cancelled', 'completed'])
  status?: string;

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
  @Max(100)
  limit?: number = 20;
}

/**
 * 活动查询 DTO
 * 支持状态筛选、分类筛选和分页
 */
export class QueryEventDto {
  @ApiPropertyOptional({
    description: '活动状态',
    enum: ['draft', 'published', 'cancelled', 'completed'],
  })
  @IsOptional()
  @IsIn(['draft', 'published', 'cancelled', 'completed'])
  status?: string;

  @ApiPropertyOptional({ description: '分类 ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: '关键词搜索' })
  @IsOptional()
  @IsString()
  keyword?: string;

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
  @Max(100)
  limit?: number = 20;
}

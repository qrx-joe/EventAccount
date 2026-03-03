import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 创建标签 DTO
 */
export class CreateTagDto {
  @ApiProperty({ description: '标签名', example: 'AI' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({
    description: '标签类型',
    enum: ['event', 'community'],
    default: 'event',
  })
  @IsOptional()
  @IsIn(['event', 'community'])
  type?: string;
}

/**
 * 标签查询 DTO
 * 支持按类型筛选和分页
 */
export class QueryTagDto {
  @ApiPropertyOptional({
    description: '标签类型筛选',
    enum: ['event', 'community'],
  })
  @IsOptional()
  @IsIn(['event', 'community'])
  type?: string;

  @ApiPropertyOptional({ description: '关键词搜索', example: 'AI' })
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

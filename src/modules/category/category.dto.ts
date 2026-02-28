import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 创建分类 DTO（管理员操作）
 */
export class CreateCategoryDto {
  @ApiProperty({ description: '分类名称', example: '科技' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'URL 标识', example: 'technology' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug: string;

  @ApiPropertyOptional({ description: '分类描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '封面图 URL' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ description: '排序权重', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/**
 * 更新分类 DTO（管理员操作）
 */
export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: '分类名称' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: '分类描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '封面图 URL' })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ description: '排序权重' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/**
 * 分类查询 DTO
 */
export class QueryCategoryDto {
  @ApiPropertyOptional({ description: '关键词搜索', example: '科技' })
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

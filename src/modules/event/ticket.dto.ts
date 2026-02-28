import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsInt,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 创建门票 DTO
 */
export class CreateTicketDto {
  @ApiProperty({ description: '票种名称', example: '普通票' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: '票种描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '价格（0=免费）', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: '数量限制（0=无限制）', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({
    description: '状态',
    enum: ['active', 'disabled'],
    default: 'active',
  })
  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: string;

  @ApiPropertyOptional({
    description: '开售时间',
    example: '2026-04-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  saleStartTime?: string;

  @ApiPropertyOptional({
    description: '停售时间',
    example: '2026-04-01T08:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  saleEndTime?: string;

  @ApiPropertyOptional({ description: '排序权重', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/**
 * 更新门票 DTO
 * 所有字段可选
 */
export class UpdateTicketDto {
  @ApiPropertyOptional({ description: '票种名称' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: '票种描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '价格（0=免费）' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: '数量限制（0=无限制）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({
    description: '状态',
    enum: ['active', 'disabled'],
  })
  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: string;

  @ApiPropertyOptional({ description: '开售时间' })
  @IsOptional()
  @IsDateString()
  saleStartTime?: string;

  @ApiPropertyOptional({ description: '停售时间' })
  @IsOptional()
  @IsDateString()
  saleEndTime?: string;

  @ApiPropertyOptional({ description: '排序权重' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

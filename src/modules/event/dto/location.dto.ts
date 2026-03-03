import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * POI 搜索请求参数
 */
export class SearchLocationDto {
  @ApiProperty({ description: '搜索关键词', example: '天安门' })
  @IsNotEmpty({ message: '关键词不能为空' })
  @IsString()
  keywords!: string;

  @ApiPropertyOptional({ description: '城市名称或 adcode', example: '北京' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: '页码，从 1 开始', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量，最大 25', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(25)
  limit?: number;
}

/**
 * 地理编码请求参数
 */
export class GeocodeDto {
  @ApiProperty({
    description: '结构化地址',
    example: '北京市朝阳区阜通东大街6号',
  })
  @IsNotEmpty({ message: '地址不能为空' })
  @IsString()
  address!: string;

  @ApiPropertyOptional({ description: '城市名称（提高精度）', example: '北京' })
  @IsOptional()
  @IsString()
  city?: string;
}

/**
 * 逆地理编码请求参数
 */
export class ReverseGeocodeDto {
  @ApiProperty({ description: '经度', example: 116.397499 })
  @IsNotEmpty({ message: '经度不能为空' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({ description: '纬度', example: 39.908722 })
  @IsNotEmpty({ message: '纬度不能为空' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;
}

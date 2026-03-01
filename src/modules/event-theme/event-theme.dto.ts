import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 活动主题查询 DTO
 * 支持外观模式筛选
 */
export class QueryEventThemeDto {
  @ApiPropertyOptional({
    description: '外观模式筛选',
    enum: ['auto', 'light', 'dark'],
  })
  @IsOptional()
  @IsString()
  appearance?: string;
}

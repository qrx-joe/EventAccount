import {
  IsString,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 查询通知列表 DTO
 */
export class QueryNotificationDto {
  @ApiPropertyOptional({
    description: '通知类型筛选',
    enum: ['registration_confirm', 'event_reminder', 'event_update', 'system'],
  })
  @IsOptional()
  @IsIn(['registration_confirm', 'event_reminder', 'event_update', 'system'])
  type?: string;

  @ApiPropertyOptional({
    description: '是否已读筛选',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  isRead?: string;

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
 * 群发消息 DTO
 * 活动创建者向参与者群发通知
 */
export class BroadcastDto {
  @ApiProperty({
    description: '群发消息标题',
    example: '活动时间调整通知',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: '群发消息内容',
    example: '活动时间调整为下午 2 点，请知悉。',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: '通知渠道',
    enum: ['in_app', 'email'],
    example: ['in_app'],
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['in_app', 'email'], { each: true })
  channels: string[];
}

import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { Type } from 'class-transformer';

// ==================== 基础类型 ====================

export enum CalendarStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

// ==================== 创建日历 DTO ====================

export class CreateCalendarDto {
  @ApiProperty({ description: '关联社区 ID' })
  @IsString()
  @IsNotEmpty()
  communityId: string;

  @ApiProperty({ description: '日历名称', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: '日历描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '主题颜色' })
  @IsString()
  @IsOptional()
  themeColor?: string;

  @ApiPropertyOptional({ description: '是否公开可见', default: true })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

// ==================== 更新日历 DTO ====================

export class UpdateCalendarDto {
  @ApiPropertyOptional({ description: '日历名称', maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: '日历描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '主题颜色' })
  @IsString()
  @IsOptional()
  themeColor?: string;

  @ApiPropertyOptional({ description: '是否公开可见' })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: '状态', enum: CalendarStatus })
  @IsEnum(CalendarStatus)
  @IsOptional()
  status?: CalendarStatus;
}

// ==================== 查询日历 DTO ====================

export class QueryCalendarDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '搜索关键词（名称）' })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiPropertyOptional({ description: '社区 ID' })
  @IsString()
  @IsOptional()
  communityId?: string;

  @ApiPropertyOptional({ description: '状态', enum: CalendarStatus })
  @IsEnum(CalendarStatus)
  @IsOptional()
  status?: CalendarStatus;
}

// ==================== 订阅日历 DTO ====================

export class SubscribeCalendarDto {
  @ApiProperty({ description: '日历 ID' })
  @IsString()
  @IsNotEmpty()
  calendarId: string;

  @ApiPropertyOptional({ description: '是否接收通知', default: true })
  @IsBoolean()
  @IsOptional()
  receiveNotification?: boolean;
}

// ==================== 响应 DTO ====================

export class CalendarResponseDto {
  id: string;
  communityId: string;
  creatorId: string;
  name: string;
  description: string | null;
  status: string;
  themeColor: string | null;
  isPublic: boolean;
  subscriberCount: number;
  createdAt: string;
  updatedAt: string;
  community?: {
    id: string;
    name: string;
    avatar: string | null;
  };
  isSubscribed?: boolean;
}

export class CalendarSubscriptionResponseDto {
  id: string;
  userId: string;
  calendarId: string;
  receiveNotification: boolean;
  createdAt: string;
  calendar?: CalendarResponseDto;
}

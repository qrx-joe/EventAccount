import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { Type } from 'class-transformer';

// ==================== 基础类型 ====================

export enum CommunityStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DISBANDED = 'disbanded',
}

export enum CommunityVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export enum CommunityMemberRole {
  CREATOR = 'creator',
  ADMIN = 'admin',
  MEMBER = 'member',
}

export enum CommunityMemberStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked',
}

// ==================== 创建社区 DTO ====================

export class CreateCommunityDto {
  @ApiProperty({ description: '社区名称', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: '社区简介' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '社区头像 URL' })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiPropertyOptional({ description: '社区封面图 URL' })
  @IsString()
  @IsOptional()
  coverImage?: string;

  @ApiPropertyOptional({
    description: '可见性',
    enum: CommunityVisibility,
    default: CommunityVisibility.PUBLIC,
  })
  @IsEnum(CommunityVisibility)
  @IsOptional()
  visibility?: CommunityVisibility;

  @ApiPropertyOptional({
    description: '是否需要审核加入',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  requireApproval?: boolean;

  @ApiPropertyOptional({ description: '标签 ID 列表' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];
}

// ==================== 更新社区 DTO ====================

export class UpdateCommunityDto {
  @ApiPropertyOptional({ description: '社区名称', maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: '社区简介' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '社区头像 URL' })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiPropertyOptional({ description: '社区封面图 URL' })
  @IsString()
  @IsOptional()
  coverImage?: string;

  @ApiPropertyOptional({
    description: '可见性',
    enum: CommunityVisibility,
  })
  @IsEnum(CommunityVisibility)
  @IsOptional()
  visibility?: CommunityVisibility;

  @ApiPropertyOptional({
    description: '状态',
    enum: CommunityStatus,
  })
  @IsEnum(CommunityStatus)
  @IsOptional()
  status?: CommunityStatus;

  @ApiPropertyOptional({
    description: '是否需要审核加入',
  })
  @IsBoolean()
  @IsOptional()
  requireApproval?: boolean;

  @ApiPropertyOptional({ description: '标签 ID 列表' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];
}

// ==================== 社区设置 DTO ====================

export class UpdateCommunitySettingsDto {
  @ApiPropertyOptional({ description: '主题颜色预设' })
  @IsString()
  @IsOptional()
  themeColor?: string;

  @ApiPropertyOptional({ description: '自定义样式配置' })
  @IsOptional()
  customStyles?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '自定义字体' })
  @IsString()
  @IsOptional()
  customFont?: string;

  @ApiPropertyOptional({
    description: '是否允许成员发起活动',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  allowMemberEvent?: boolean;

  @ApiPropertyOptional({
    description: '是否开启社区讨论',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  enableDiscussion?: boolean;

  @ApiPropertyOptional({
    description: '每日发送限额（0=无限制）',
    default: 0,
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  dailySendLimit?: number;

  @ApiPropertyOptional({ description: '嵌入代码' })
  @IsString()
  @IsOptional()
  embedCode?: string;

  @ApiPropertyOptional({ description: '自定义域名' })
  @IsString()
  @IsOptional()
  customDomain?: string;

  @ApiPropertyOptional({ description: 'Webhook URL' })
  @IsString()
  @IsOptional()
  webhookUrl?: string;
}

// ==================== 查询 DTO ====================

export class QueryCommunityDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '关键词搜索（名称）' })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiPropertyOptional({
    description: '状态筛选',
    enum: CommunityStatus,
  })
  @IsEnum(CommunityStatus)
  @IsOptional()
  status?: CommunityStatus;

  @ApiPropertyOptional({
    description: '可见性筛选',
    enum: CommunityVisibility,
  })
  @IsEnum(CommunityVisibility)
  @IsOptional()
  visibility?: CommunityVisibility;
}

export class MyCommunitiesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: '角色筛选',
    enum: CommunityMemberRole,
  })
  @IsEnum(CommunityMemberRole)
  @IsOptional()
  role?: CommunityMemberRole;
}

// ==================== 成员管理 DTO ====================

export class AddCommunityMemberDto {
  @ApiProperty({ description: '用户 ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    description: '角色',
    enum: CommunityMemberRole,
    default: CommunityMemberRole.MEMBER,
  })
  @IsEnum(CommunityMemberRole)
  @IsOptional()
  role?: CommunityMemberRole;

  @ApiPropertyOptional({ description: '备注' })
  @IsString()
  @IsOptional()
  remark?: string;
}

export class UpdateCommunityMemberDto {
  @ApiPropertyOptional({
    description: '角色',
    enum: CommunityMemberRole,
  })
  @IsEnum(CommunityMemberRole)
  @IsOptional()
  role?: CommunityMemberRole;

  @ApiPropertyOptional({
    description: '状态',
    enum: CommunityMemberStatus,
  })
  @IsEnum(CommunityMemberStatus)
  @IsOptional()
  status?: CommunityMemberStatus;
}

export class JoinCommunityDto {
  @ApiPropertyOptional({ description: '申请备注/自我介绍' })
  @IsString()
  @IsOptional()
  remark?: string;
}

// ==================== 响应 DTO ====================

export class CommunityResponseDto {
  id: string;
  creatorId: string;
  name: string;
  description: string | null;
  avatar: string | null;
  coverImage: string | null;
  status: string;
  visibility: string;
  memberCount: number;
  requireApproval: boolean;
  themeColor: string | null;
  customFont: string | null;
  allowMemberEvent: boolean;
  enableDiscussion: boolean;
  dailySendLimit: number;
  customDomain: string | null;
  createdAt: Date;
  updatedAt: Date;
  creator?: {
    id: string;
    nickname: string;
    avatar: string | null;
  };
  tags?: {
    id: string;
    name: string;
  }[];
  memberRole?: string;
}

export class CommunityMemberResponseDto {
  id: string;
  communityId: string;
  userId: string;
  role: string;
  status: string;
  joinedAt: Date | null;
  remark: string | null;
  createdAt: Date;
  user?: {
    id: string;
    nickname: string;
    avatar: string | null;
    phone: string;
  };
}

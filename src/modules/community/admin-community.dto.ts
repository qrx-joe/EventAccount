import {
  IsOptional,
  IsString,
  IsEnum,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/** 管理端社区状态 */
export enum AdminCommunityStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/** 管理员查询社区列表参数 */
export class AdminCommunityQueryDto extends PaginationQueryDto {
  @ApiProperty({ description: '搜索关键词（社区名称）', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: '状态筛选', enum: AdminCommunityStatus, required: false })
  @IsOptional()
  @IsEnum(AdminCommunityStatus)
  status?: AdminCommunityStatus;
}

/** 管理员视角的社区信息 */
export class AdminCommunityDto {
  @ApiProperty({ description: '社区 ID' })
  id: string;

  @ApiProperty({ description: '创建者 ID' })
  creatorId: string;

  @ApiProperty({ description: '社区名称' })
  name: string;

  @ApiProperty({ description: '社区简介' })
  description: string | null;

  @ApiProperty({ description: '社区头像 URL' })
  avatar: string | null;

  @ApiProperty({ description: '社区封面图 URL' })
  coverImage: string | null;

  @ApiProperty({ description: '状态', enum: AdminCommunityStatus })
  status: AdminCommunityStatus;

  @ApiProperty({ description: '可见性' })
  visibility: string;

  @ApiProperty({ description: '成员数量' })
  memberCount: number;

  @ApiProperty({ description: '是否需要审核加入' })
  requireApproval: boolean;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;

  @ApiProperty({ description: '创建者信息' })
  creator?: {
    id: string;
    nickname: string | null;
    avatar: string | null;
  };
}

/** 管理员更新社区请求 */
export class AdminUpdateCommunityDto {
  @ApiProperty({ description: '社区名称', required: false })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiProperty({ description: '社区简介', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '状态', enum: AdminCommunityStatus, required: false })
  @IsOptional()
  @IsEnum(AdminCommunityStatus)
  status?: AdminCommunityStatus;
}

/** 管理员切换社区状态请求 */
export class AdminToggleCommunityStatusDto {
  @ApiProperty({ description: '是否启用', enum: AdminCommunityStatus })
  @IsEnum(AdminCommunityStatus)
  status: AdminCommunityStatus;
}

import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  Length,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { UserRole } from './user.entity';

/** 管理员查询用户列表参数 */
export class AdminUserQueryDto extends PaginationQueryDto {
  @ApiProperty({ description: '搜索关键词（昵称/手机/邮箱）', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: '角色筛选', enum: UserRole, required: false })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({ description: '状态筛选', required: false })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}

/** 管理员视角的完整用户信息 */
export class AdminUserDto {
  @ApiProperty({ description: '用户 ID' })
  id: string;

  @ApiProperty({ description: '手机号' })
  phone: string;

  @ApiProperty({ description: '昵称' })
  nickname: string | null;

  @ApiProperty({ description: '邮箱' })
  email: string | null;

  @ApiProperty({ description: '头像 URL' })
  avatar: string | null;

  @ApiProperty({ description: '个性签名' })
  bio: string | null;

  @ApiProperty({ description: '角色', enum: UserRole })
  role: UserRole;

  @ApiProperty({ description: '是否启用' })
  isActive: boolean;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

/** 管理员更新用户请求（仅 nickname、role） */
export class AdminUpdateUserDto {
  @ApiProperty({ description: '昵称', required: false })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  nickname?: string;

  @ApiProperty({ description: '角色', enum: UserRole, required: false })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

/** 管理员切换用户状态请求 */
export class AdminToggleStatusDto {
  @ApiProperty({ description: '是否启用' })
  @Type(() => Boolean)
  @IsBoolean()
  isActive: boolean;
}

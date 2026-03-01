import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/** 创建用户请求体 */
export class CreateUserDto {
  @ApiProperty({
    description: '手机号（主登录凭证）',
    example: '13800138000',
  })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({
    description: '密码（6-128 位）',
    example: 'password123',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(6, 128)
  password?: string;

  @ApiProperty({
    description: '昵称',
    example: '张三',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  nickname?: string;

  @ApiProperty({
    description: '邮箱',
    example: 'zhangsan@example.com',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: '头像 URL',
    example: 'https://example.com/avatar.png',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  avatar?: string;

  @ApiProperty({
    description: '个性签名',
    example: '这个人很懒，什么都没留下',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  bio?: string;
}

/** 更新用户请求体（仅允许更新昵称、头像、签名；邮箱变更走 PUT /me/email） */
export class UpdateUserDto {
  @ApiProperty({
    description: '昵称',
    example: '张三',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  nickname?: string;

  @ApiProperty({
    description: '头像 URL',
    example: 'https://example.com/avatar.png',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  avatar?: string;

  @ApiProperty({
    description: '个性签名',
    example: '这个人很懒，什么都没留下',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  bio?: string;
}

/** 用户自身信息响应（含手机号、邮箱等私有字段，不含密码） */
export class UserSelfDto {
  @ApiProperty({ description: '用户 ID', example: '01924a7e-...' })
  id: string;

  @ApiProperty({ description: '手机号', example: '13800138000' })
  phone: string;

  @ApiProperty({ description: '昵称', example: '张三' })
  nickname: string | null;

  @ApiProperty({ description: '邮箱', example: 'zhangsan@example.com' })
  email: string | null;

  @ApiProperty({
    description: '头像 URL',
    example: 'https://example.com/avatar.png',
  })
  avatar: string | null;

  @ApiProperty({ description: '个性签名', example: '这个人很懒' })
  bio: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

/** 用户公开信息响应（列表与公开资料） */
export class UserPublicDto {
  @ApiProperty({ description: '用户 ID', example: '01924a7e-...' })
  id: string;

  @ApiProperty({ description: '昵称', example: '张三' })
  nickname: string | null;

  @ApiProperty({
    description: '头像 URL',
    example: 'https://example.com/avatar.png',
  })
  avatar: string | null;

  @ApiProperty({ description: '个性签名', example: '这个人很懒' })
  bio: string | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}

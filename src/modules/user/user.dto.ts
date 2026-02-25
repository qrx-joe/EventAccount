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
  @Transform(({ value }) =>
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

/** 更新用户请求体（仅允许更新昵称、邮箱、头像、签名） */
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
    description: '邮箱',
    example: 'zhangsan@example.com',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
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

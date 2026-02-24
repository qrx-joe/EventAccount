import { IsString, Length, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PHONE_REGEX } from '../../common/constants/phone';

/** JWT payload 结构（只保留用户 ID，避免易变字段导致 token 过期前信息不一致） */
export interface JwtPayload {
  sub: string;
}

/** 注册请求体 */
export class RegisterDto {
  @ApiProperty({ description: '手机号（中国大陆）', example: '13800138000' })
  @IsString()
  @Matches(PHONE_REGEX, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({ description: '短信验证码（6位数字）', example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码为6位数字' })
  smsCode: string;

  @ApiProperty({ description: '密码（6-128位）', example: 'password123' })
  @IsString()
  @Length(6, 128)
  password: string;

  @ApiProperty({
    description: '昵称（可选，不传则自动生成）',
    example: '张三',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  nickname?: string;
}

/** 密码登录请求体 */
export class LoginPasswordDto {
  @ApiProperty({ description: '手机号（中国大陆）', example: '13800138000' })
  @IsString()
  @Matches(PHONE_REGEX, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({ description: '密码', example: 'password123' })
  @IsString()
  @Length(6, 128)
  password: string;
}

/** 短信验证码登录请求体 */
export class SmsLoginDto {
  @ApiProperty({ description: '手机号（中国大陆）', example: '13800138000' })
  @IsString()
  @Matches(PHONE_REGEX, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({ description: '短信验证码（6位数字）', example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码为6位数字' })
  smsCode: string;
}

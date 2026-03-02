import {
  IsEmail,
  IsString,
  Length,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PHONE_REGEX } from '../../common/constants/phone';
import { UserRole } from '../user/user.entity';

/** JWT payload 结构（包含用户 ID 和角色，角色变更需重新登录获取新 token） */
export interface JwtPayload {
  sub: string;
  role: UserRole;
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

/** 重置密码 token payload（手动验证，不走 JwtAuthGuard） */
export interface ResetTokenPayload {
  sub: string;
  purpose: 'password-reset';
}

/** 忘记密码 - 验证身份请求体 */
export class ForgotPasswordVerifyDto {
  @ApiProperty({ description: '手机号（中国大陆）', example: '13800138000' })
  @IsString()
  @Matches(PHONE_REGEX, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({ description: '短信验证码（6位数字）', example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码为6位数字' })
  smsCode: string;
}

/** 重置密码请求体 */
export class ResetPasswordDto {
  @ApiProperty({ description: '重置密码令牌' })
  @IsString()
  resetToken: string;

  @ApiProperty({ description: '新密码（6-128位）', example: 'newPassword123' })
  @IsString()
  @Length(6, 128)
  newPassword: string;

  @ApiProperty({ description: '确认新密码', example: 'newPassword123' })
  @IsString()
  @Length(6, 128)
  confirmPassword: string;
}

/** 邮箱验证码登录请求体 */
export class EmailLoginDto {
  @ApiProperty({ description: '邮箱地址', example: 'user@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @ApiProperty({ description: '邮箱验证码（6位数字）', example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码为6位数字' })
  emailCode: string;
}

/** 忘记密码 - 邮箱验证身份请求体 */
export class ForgotPasswordEmailVerifyDto {
  @ApiProperty({ description: '邮箱地址', example: 'user@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @ApiProperty({ description: '邮箱验证码（6位数字）', example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码为6位数字' })
  emailCode: string;
}

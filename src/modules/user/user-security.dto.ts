import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/** 修改密码请求体（已登录状态） */
export class ChangePasswordDto {
  @ApiProperty({ description: '当前密码', example: 'oldpass123' })
  @IsString()
  @Length(6, 128)
  oldPassword: string;

  @ApiProperty({ description: '新密码（6-128 位）', example: 'newpass456' })
  @IsString()
  @Length(6, 128)
  newPassword: string;

  @ApiProperty({ description: '确认新密码', example: 'newpass456' })
  @IsString()
  @Length(6, 128)
  confirmPassword: string;
}

/** 换绑手机号请求体 */
export class ChangePhoneDto {
  @ApiProperty({ description: '新手机号', example: '13900139000' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  newPhone: string;

  @ApiProperty({ description: '短信验证码（6 位）', example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码为 6 位数字' })
  smsCode: string;
}

/** 换绑邮箱请求体 */
export class ChangeEmailDto {
  @ApiProperty({ description: '新邮箱', example: 'new@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  newEmail: string;

  @ApiProperty({ description: '邮箱验证码（6 位）', example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码为 6 位数字' })
  emailCode: string;
}

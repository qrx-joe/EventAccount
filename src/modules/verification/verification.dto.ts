import { IsEnum, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PHONE_REGEX } from '../../common/constants/phone';

/** 验证码类型枚举 */
export enum VerificationCodeType {
  REGISTER = 'register',
  LOGIN = 'login',
  RESET = 'reset',
  BIND_PHONE = 'bindphone',
}

/** 发送短信验证码请求体 */
export class SendSmsCodeDto {
  @ApiProperty({
    description: '手机号（中国大陆）',
    example: '13800138000',
  })
  @IsString()
  @Matches(PHONE_REGEX, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({
    description: '验证码类型',
    example: 'register',
    enum: VerificationCodeType,
  })
  @IsEnum(VerificationCodeType)
  type: VerificationCodeType;
}

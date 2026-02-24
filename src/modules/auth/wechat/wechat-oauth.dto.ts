import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PHONE_REGEX } from '../../../common/constants/phone';

/** 微信回调 Query 参数 */
export class WechatCallbackQueryDto {
  @ApiProperty({ description: '微信授权码' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'CSRF 防护 state' })
  @IsString()
  state: string;
}

/** 微信绑定手机号请求体 */
export class WechatBindPhoneDto {
  @ApiProperty({ description: '绑定令牌' })
  @IsString()
  bindToken: string;

  @ApiProperty({ description: '手机号（中国大陆）', example: '13800138000' })
  @IsString()
  @Matches(PHONE_REGEX, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({ description: '短信验证码（6位数字）', example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码为6位数字' })
  smsCode: string;
}

/** 微信用户信息（内部使用） */
export interface WechatUserInfo {
  openid: string;
  unionid?: string;
  nickname: string;
  headimgurl: string;
}

/** 绑定手机号 token payload */
export interface WechatBindTokenPayload {
  sub: string;
  purpose: 'wechat-bindphone';
  openid: string;
  unionid?: string;
  nickname: string;
  avatar: string;
}

/** 微信回调结果 */
export interface WechatCallbackResult {
  action: 'login' | 'bindphone';
  token?: string;
  bindToken?: string;
  wechatNickname?: string;
  wechatAvatar?: string;
}

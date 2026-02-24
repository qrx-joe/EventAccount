import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { UserService } from '../../user/user.service';
import { VerificationService } from '../../verification/verification.service';
import { VerificationCodeType } from '../../verification/verification.dto';
import { AgreementService } from '../../agreement/agreement.service';
import { JwtPayload } from '../auth.dto';
import {
  WechatUserInfo,
  WechatBindTokenPayload,
  WechatCallbackResult,
  WechatBindPhoneDto,
} from './wechat-oauth.dto';

/** state 过期时间（5 分钟） */
const STATE_EXPIRE_MS = 5 * 60 * 1000;

/** 清理 state 间隔（5 分钟） */
const STATE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * 微信 OAuth 服务
 * 负责微信扫码登录的授权、回调处理、手机号绑定
 * WECHAT_OPEN_APPID 为空时自动进入 Mock 模式
 */
@Injectable()
export class WechatOAuthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WechatOAuthService.name);

  /** state 防重放存储：state → 过期时间戳 */
  private readonly stateStore = new Map<string, number>();

  /** 清理定时器 */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /** 是否为 Mock 模式 */
  private readonly isMockMode: boolean;

  private readonly appId: string;
  private readonly appSecret: string;
  private readonly callbackUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly verificationService: VerificationService,
    private readonly agreementService: AgreementService,
  ) {
    this.appId = this.configService.get<string>('wechat.appId') || '';
    this.appSecret = this.configService.get<string>('wechat.appSecret') || '';
    this.callbackUrl =
      this.configService.get<string>('wechat.callbackUrl') ||
      'http://localhost:5173/wechat/callback';
    this.isMockMode = !this.appId;

    if (this.isMockMode) {
      this.logger.warn('微信 OAuth 进入 Mock 模式（WECHAT_OPEN_APPID 未配置）');
    } else {
      this.logger.log('微信 OAuth 已配置，使用真实模式');
    }
  }

  /** 启动定期清理过期 state */
  onModuleInit(): void {
    this.cleanupTimer = setInterval(
      () => this.cleanupExpiredStates(),
      STATE_CLEANUP_INTERVAL_MS,
    );
  }

  /** 模块销毁时清除定时器 */
  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /** 清理过期 state */
  private cleanupExpiredStates(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [state, expireAt] of this.stateStore) {
      if (now > expireAt) {
        this.stateStore.delete(state);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.logger.debug(`清理过期 state: ${cleaned} 条`);
    }
  }

  /**
   * 生成微信授权 URL
   * Mock 模式直接返回前端 callback 页面地址（带 mock_code + state）
   */
  getAuthorizeUrl(): { authorizeUrl: string } {
    const state = randomBytes(16).toString('hex');
    this.stateStore.set(state, Date.now() + STATE_EXPIRE_MS);

    if (this.isMockMode) {
      // Mock 模式：直接跳转前端 callback 页面
      const authorizeUrl = `${this.callbackUrl}?code=mock_code&state=${state}`;
      return { authorizeUrl };
    }

    // 真实模式：微信开放平台授权 URL
    const authorizeUrl =
      `https://open.weixin.qq.com/connect/qrconnect` +
      `?appid=${this.appId}` +
      `&redirect_uri=${encodeURIComponent(this.callbackUrl)}` +
      `&response_type=code` +
      `&scope=snsapi_login` +
      `&state=${state}` +
      `#wechat_redirect`;
    return { authorizeUrl };
  }

  /**
   * 处理微信回调
   * 验证 state → 获取用户信息 → 已绑定直接登录 / 未绑定返回绑定令牌
   */
  async handleCallback(
    code: string,
    state: string,
  ): Promise<WechatCallbackResult> {
    // 验证 state（一次性使用，防重放攻击）
    const expireAt = this.stateStore.get(state);
    if (!expireAt || Date.now() > expireAt) {
      throw new BadRequestException('state 无效或已过期');
    }
    this.stateStore.delete(state);

    // 获取微信用户信息
    const wechatUser = await this.getWechatUserInfo(code);

    // 查询是否已有绑定用户
    const existingUser = await this.userService.findByWechatOpenId(
      wechatUser.openid,
    );
    if (existingUser) {
      // 已绑定，直接签发 token
      const payload: JwtPayload = { sub: existingUser.id };
      const token = this.jwtService.sign(payload);
      this.logger.log(`微信用户登录成功: ${existingUser.id}`);
      return { action: 'login', token };
    }

    // 未绑定，签发 bindToken（10 分钟有效）
    const bindPayload: WechatBindTokenPayload = {
      sub: `wechat:${wechatUser.openid}`,
      purpose: 'wechat-bindphone',
      openid: wechatUser.openid,
      unionid: wechatUser.unionid,
      nickname: wechatUser.nickname,
      avatar: wechatUser.headimgurl,
    };
    const bindToken = this.jwtService.sign(bindPayload, { expiresIn: '10m' });

    return {
      action: 'bindphone',
      bindToken,
      wechatNickname: wechatUser.nickname,
      wechatAvatar: wechatUser.headimgurl,
    };
  }

  /**
   * 绑定手机号
   * 解析 bindToken → 校验短信验证码 → 查找/创建用户 → 关联微信 → 签发 token
   */
  async bindPhone(dto: WechatBindPhoneDto): Promise<{ token: string }> {
    // 解析 bindToken
    let payload: WechatBindTokenPayload;
    try {
      payload = this.jwtService.verify<WechatBindTokenPayload>(dto.bindToken);
    } catch {
      throw new UnauthorizedException('绑定令牌无效或已过期');
    }

    if (payload.purpose !== 'wechat-bindphone') {
      throw new UnauthorizedException('令牌用途不正确');
    }

    // 校验短信验证码
    const codeValid = this.verificationService.verifyCode(
      dto.phone,
      VerificationCodeType.BIND_PHONE,
      dto.smsCode,
    );
    if (!codeValid) {
      throw new BadRequestException('验证码无效或已过期');
    }

    // 查询手机号对应的用户
    const existingUser = await this.userService.findByPhone(dto.phone);

    if (existingUser) {
      // 检查该 openid 是否已绑定到其他用户
      const wechatUser = await this.userService.findByWechatOpenId(
        payload.openid,
      );
      if (wechatUser && wechatUser.id !== existingUser.id) {
        throw new ConflictException('该微信已绑定其他账号');
      }

      // openid 尚未绑定任何用户，执行关联
      if (!wechatUser) {
        await this.userService.linkWechat(
          existingUser.id,
          payload.openid,
          payload.unionid,
        );
      }

      const jwtPayload: JwtPayload = { sub: existingUser.id };
      const token = this.jwtService.sign(jwtPayload);
      this.logger.log(`微信绑定已有用户成功: ${existingUser.id}`);
      return { token };
    }

    // 没有对应用户：创建新用户
    const newUser = await this.userService.createFromWechat({
      phone: dto.phone,
      nickname: payload.nickname || `用户${dto.phone.slice(-4)}`,
      avatar: payload.avatar,
      wechatOpenId: payload.openid,
      wechatUnionId: payload.unionid,
    });

    // 自动签署注册协议
    await this.agreementService.autoSignOnRegister(newUser.id);

    const jwtPayload: JwtPayload = { sub: newUser.id };
    const token = this.jwtService.sign(jwtPayload);
    this.logger.log(`微信新用户创建并绑定成功: ${newUser.id}`);
    return { token };
  }

  /**
   * 获取微信用户信息
   * Mock 模式返回固定数据，真实模式通过微信 API 获取
   */
  private async getWechatUserInfo(code: string): Promise<WechatUserInfo> {
    if (this.isMockMode) {
      this.logger.log('[Mock] 返回模拟微信用户信息');
      return {
        openid: 'mock_openid_fixed',
        nickname: '微信Mock用户',
        headimgurl: '',
      };
    }

    // 真实模式：先获取 access_token，再获取用户信息
    const tokenUrl =
      `https://api.weixin.qq.com/sns/oauth2/access_token` +
      `?appid=${this.appId}` +
      `&secret=${this.appSecret}` +
      `&code=${code}` +
      `&grant_type=authorization_code`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      openid?: string;
      errcode?: number;
      errmsg?: string;
    };

    if (!tokenData.access_token || !tokenData.openid) {
      this.logger.error(
        `微信获取 access_token 失败: ${tokenData.errcode} - ${tokenData.errmsg}`,
      );
      throw new UnauthorizedException('微信授权失败');
    }

    const userInfoUrl =
      `https://api.weixin.qq.com/sns/userinfo` +
      `?access_token=${tokenData.access_token}` +
      `&openid=${tokenData.openid}` +
      `&lang=zh_CN`;

    const userRes = await fetch(userInfoUrl);
    const userData = (await userRes.json()) as {
      openid?: string;
      unionid?: string;
      nickname?: string;
      headimgurl?: string;
      errcode?: number;
      errmsg?: string;
    };

    if (!userData.openid) {
      this.logger.error(
        `微信获取用户信息失败: ${userData.errcode} - ${userData.errmsg}`,
      );
      throw new UnauthorizedException('获取微信用户信息失败');
    }

    return {
      openid: userData.openid,
      unionid: userData.unionid,
      nickname: userData.nickname || '微信用户',
      headimgurl: userData.headimgurl || '',
    };
  }
}

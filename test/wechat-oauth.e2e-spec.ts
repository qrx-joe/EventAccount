import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { VerificationService } from '../src/modules/verification/verification.service';
import { UserService } from '../src/modules/user/user.service';
import { WechatBindTokenPayload } from '../src/modules/auth/wechat/wechat-oauth.dto';

/**
 * 微信 OAuth 端到端测试（10 个用例）
 * Mock 模式下测试完整流程：获取授权链接 → 回调 → 绑定手机号 → 登录
 *
 * 注意：测试连接开发数据库，使用唯一测试手机号避免数据冲突
 */
describe('WeChat OAuth (e2e)', () => {
  let app: INestApplication<App>;
  let verificationService: VerificationService;
  let userService: UserService;
  let jwtService: JwtService;

  /** 测试手机号（不会与真实数据冲突的号段） */
  const TEST_PHONE_WECHAT = '13900099901';
  const TEST_PHONE_EXISTING = '13900099902';

  /** 跨测试共享状态 */
  let savedState: string;
  let bindToken: string;
  let loginToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // 禁用速率限制，避免测试时触发 429
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    verificationService = app.get(VerificationService);
    userService = app.get(UserService);
    jwtService = app.get(JwtService);

    // 清理残留测试数据
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  /** 清理测试数据：按手机号和微信 openid 分别查找并删除 */
  async function cleanupTestData(): Promise<void> {
    for (const phone of [TEST_PHONE_WECHAT, TEST_PHONE_EXISTING]) {
      const user = await userService.findByPhone(phone);
      if (user) {
        await userService.remove(user.id);
      }
    }
    const wechatUser =
      await userService.findByWechatOpenId('mock_openid_fixed');
    if (wechatUser) {
      await userService.remove(wechatUser.id);
    }
  }

  // ─── 测试 1: 获取微信授权链接（Mock 模式）─────────────
  it('GET /api/auth/wechat → 200，返回含 mock_code 的授权链接', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/wechat')
      .expect(200);

    expect(res.body.success).toBe(true);
    const { authorizeUrl } = res.body.data;
    expect(authorizeUrl).toContain('mock_code');
    expect(authorizeUrl).toContain('state=');

    // 提取 state 供后续测试使用
    const url = new URL(authorizeUrl);
    savedState = url.searchParams.get('state')!;
    expect(savedState).toHaveLength(32); // 16 bytes hex
  });

  // ─── 测试 2: 微信回调 - 新用户 → bindphone ────────────
  it('GET /api/auth/wechat/callback 新用户 → action=bindphone + bindToken', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/wechat/callback')
      .query({ code: 'mock_code', state: savedState })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.action).toBe('bindphone');
    expect(res.body.data.bindToken).toBeDefined();
    expect(res.body.data.wechatNickname).toBe('微信Mock用户');

    bindToken = res.body.data.bindToken;
  });

  // ─── 测试 3: state 重放攻击 → 400（一次性使用）────────
  it('GET /api/auth/wechat/callback state 重放 → 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/wechat/callback')
      .query({ code: 'mock_code', state: savedState })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  // ─── 测试 4: 发送绑定手机号验证码 ────────────────────
  it('POST /api/auth/sms/send type=bindphone → 200', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sms/send')
      .send({ phone: TEST_PHONE_WECHAT, type: 'bindphone' })
      .expect(201);

    expect(res.body.success).toBe(true);
  });

  // ─── 测试 5: 绑定手机号 → 成功获得 token ──────────────
  it('POST /api/auth/wechat/bindphone → 201 + token', async () => {
    // Mock 验证码校验通过（无法获取 Mock 生成的随机验证码）
    jest.spyOn(verificationService, 'verifyCode').mockReturnValueOnce(true);

    const res = await request(app.getHttpServer())
      .post('/api/auth/wechat/bindphone')
      .send({
        bindToken,
        phone: TEST_PHONE_WECHAT,
        smsCode: '123456',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    loginToken = res.body.data.token;
  });

  // ─── 测试 6: 用 token 访问 /users/me → 200 ───────────
  it('GET /api/users/me → 200，确认微信用户信息正确', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${loginToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.phone).toBe(TEST_PHONE_WECHAT);
    expect(res.body.data.nickname).toBe('微信Mock用户');
  });

  // ─── 测试 7: 老用户回归 → 直接登录 ───────────────────
  it('微信老用户回归 → action=login + token', async () => {
    // 获取新 state
    const authRes = await request(app.getHttpServer())
      .get('/api/auth/wechat')
      .expect(200);
    const url = new URL(authRes.body.data.authorizeUrl);
    const newState = url.searchParams.get('state')!;

    // 回调（mock_openid_fixed 已绑定用户，应直接登录）
    const res = await request(app.getHttpServer())
      .get('/api/auth/wechat/callback')
      .query({ code: 'mock_code', state: newState })
      .expect(200);

    expect(res.body.data.action).toBe('login');
    expect(res.body.data.token).toBeDefined();

    // 验证 token 有效
    const meRes = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${res.body.data.token}`)
      .expect(200);
    expect(meRes.body.data.phone).toBe(TEST_PHONE_WECHAT);
  });

  // ─── 测试 8: 无效 bindToken → 401 ────────────────────
  it('POST /api/auth/wechat/bindphone 无效 bindToken → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/wechat/bindphone')
      .send({
        bindToken: 'invalid.jwt.token',
        phone: TEST_PHONE_WECHAT,
        smsCode: '123456',
      })
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  // ─── 测试 9: 微信已绑定其他账号 → 409 ────────────────
  it('POST /api/auth/wechat/bindphone 该微信已绑定其他账号 → 409', async () => {
    // 先注册一个普通用户（不同手机号）
    jest.spyOn(verificationService, 'verifyCode').mockReturnValueOnce(true);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        phone: TEST_PHONE_EXISTING,
        password: 'TestPass123!',
        smsCode: '123456',
      })
      .expect(201);

    // 伪造 bindToken：openid = mock_openid_fixed（已绑定 TEST_PHONE_WECHAT 用户）
    const payload: WechatBindTokenPayload = {
      sub: 'wechat:mock_openid_fixed',
      purpose: 'wechat-bindphone',
      openid: 'mock_openid_fixed',
      nickname: '测试',
      avatar: '',
    };
    const forgedBindToken = jwtService.sign(payload, { expiresIn: '10m' });

    // 尝试将 mock_openid_fixed 绑定到另一个用户 → 409 冲突
    jest.spyOn(verificationService, 'verifyCode').mockReturnValueOnce(true);
    const res = await request(app.getHttpServer())
      .post('/api/auth/wechat/bindphone')
      .send({
        bindToken: forgedBindToken,
        phone: TEST_PHONE_EXISTING,
        smsCode: '123456',
      })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('已绑定');
  });

  // ─── 测试 10: 微信用户尝试密码登录 → 401 ──────────────
  it('POST /api/auth/login/password 微信用户无密码 → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login/password')
      .send({
        phone: TEST_PHONE_WECHAT,
        password: 'AnyPassword123!',
      })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('未设置密码');
  });
});

import request from 'supertest';
import type { Response } from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import {
  clearMutableData,
  closeE2eApp,
  createE2eApp,
  seedVerificationCode,
} from './e2e-helpers';
import { VerificationCodeType } from '../src/modules/verification/verification.dto';
import { parseApiResponse } from './api-response-test-utils';

function getHttpServer(app: INestApplication): App {
  return app.getHttpServer() as unknown as App;
}

type TokenData = { token: string };
type UserPublic = {
  id: string;
  nickname: string | null;
  avatar: string | null;
  bio: string | null;
  createdAt: string;
};
type AgreementSign = { agreementType: string };
type ResetTokenData = { resetToken: string };

describe('认证与用户主链路 (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  beforeEach(async () => {
    await clearMutableData(app);
  });

  afterAll(async () => {
    await closeE2eApp(app);
  });

  it('注册成功后自动签署协议，且 /users 返回公开字段', async () => {
    const phone = '13800138001';
    const smsCode = '123456';
    await seedVerificationCode(
      app,
      phone,
      VerificationCodeType.REGISTER,
      smsCode,
    );

    const registerRes = await request(getHttpServer(app))
      .post('/api/auth/register')
      .send({ phone, smsCode, password: 'Password123', nickname: '用户A' })
      .expect(201);

    const registerBody = parseApiResponse<TokenData>(registerRes);
    const token = registerBody.data?.token;
    expect(token).toBeTruthy();

    const usersRes = await request(getHttpServer(app))
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const usersBody = parseApiResponse<UserPublic[]>(usersRes);
    expect(Array.isArray(usersBody.data)).toBe(true);
    const firstUser = usersBody.data?.[0];
    expect(firstUser).toBeTruthy();
    expect(typeof firstUser?.id).toBe('string');
    expect(typeof firstUser?.nickname).toBe('string');
    expect(firstUser?.avatar).toBeNull();
    expect(firstUser?.bio).toBeNull();
    expect(typeof firstUser?.createdAt).toBe('string');
    expect(firstUser).not.toHaveProperty('phone');
    expect(firstUser).not.toHaveProperty('email');

    const signedRes = await request(getHttpServer(app))
      .get('/api/agreements/signed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const signedBody = parseApiResponse<AgreementSign[]>(signedRes);
    const signedTypes = (signedBody.data ?? []).map(
      (item) => item.agreementType,
    );
    expect(signedTypes).toEqual(
      expect.arrayContaining(['user-terms', 'privacy-policy']),
    );
  });

  it('无效 token 访问受保护接口返回 401 且响应体统一', async () => {
    await request(getHttpServer(app))
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401)
      .expect((res: Response) => {
        const body = parseApiResponse<null>(res);
        expect(body.success).toBe(false);
        expect(body.code).toBe(401);
        expect(typeof body.message).toBe('string');
        expect(body.data).toBeNull();
        expect(typeof body.timestamp).toBe('string');
      });
  });

  it('A 用户访问 B 用户详情返回 403', async () => {
    const phoneA = '13800138002';
    const phoneB = '13800138003';

    await seedVerificationCode(
      app,
      phoneA,
      VerificationCodeType.REGISTER,
      '111111',
    );
    const userARegisterRes = await request(getHttpServer(app))
      .post('/api/auth/register')
      .send({
        phone: phoneA,
        smsCode: '111111',
        password: 'Password123',
        nickname: '用户A',
      })
      .expect(201);
    const userABody = parseApiResponse<TokenData>(userARegisterRes);
    const tokenA = userABody.data?.token;

    await seedVerificationCode(
      app,
      phoneB,
      VerificationCodeType.REGISTER,
      '222222',
    );
    await request(getHttpServer(app))
      .post('/api/auth/register')
      .send({
        phone: phoneB,
        smsCode: '222222',
        password: 'Password123',
        nickname: '用户B',
      })
      .expect(201);

    const usersRes = await request(getHttpServer(app))
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const usersBody = parseApiResponse<UserPublic[]>(usersRes);
    const userB = (usersBody.data ?? []).find(
      (item) => item.nickname === '用户B',
    );
    expect(userB?.id).toBeTruthy();

    await request(getHttpServer(app))
      .get(`/api/users/${userB?.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
  });

  it('短信找回重置密码后：旧密码失效，新密码可登录', async () => {
    const phone = '13800138004';

    await seedVerificationCode(
      app,
      phone,
      VerificationCodeType.REGISTER,
      '333333',
    );
    await request(getHttpServer(app))
      .post('/api/auth/register')
      .send({
        phone,
        smsCode: '333333',
        password: 'OldPass123',
        nickname: '重置用户',
      })
      .expect(201);

    await seedVerificationCode(
      app,
      phone,
      VerificationCodeType.RESET,
      '444444',
    );
    const verifyRes = await request(getHttpServer(app))
      .post('/api/auth/password/verify-reset')
      .send({ phone, smsCode: '444444' })
      .expect(201);

    const verifyBody = parseApiResponse<ResetTokenData>(verifyRes);
    expect(verifyBody.code).toBe(200);

    const resetToken = verifyBody.data?.resetToken;
    expect(resetToken).toBeTruthy();

    await request(getHttpServer(app))
      .post('/api/auth/password/reset')
      .send({
        resetToken,
        newPassword: 'NewPass123',
        confirmPassword: 'NewPass123',
      })
      .expect(201)
      .expect((res: Response) => {
        const body = parseApiResponse<null>(res);
        expect(body.code).toBe(200);
      });

    await request(getHttpServer(app))
      .post('/api/auth/login/password')
      .send({ phone, password: 'OldPass123' })
      .expect(401);

    await request(getHttpServer(app))
      .post('/api/auth/login/password')
      .send({ phone, password: 'NewPass123' })
      .expect(201)
      .expect((res: Response) => {
        const body = parseApiResponse<TokenData>(res);
        expect(body.code).toBe(200);
        expect(body.data?.token).toBeTruthy();
      });
  });
});

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

type UserSelf = {
  id: string;
  phone: string;
  email: string | null;
};

function getHttpServer(app: INestApplication): App {
  return app.getHttpServer() as unknown as App;
}

async function registerUser(
  app: INestApplication,
  phone: string,
  password: string,
  nickname: string,
): Promise<request.Agent> {
  const agent = request.agent(getHttpServer(app));
  await seedVerificationCode(
    app,
    phone,
    VerificationCodeType.REGISTER,
    '123456',
  );

  await agent
    .post('/api/auth/register')
    .send({ phone, smsCode: '123456', password, nickname })
    .expect(201)
    .expect((res: Response) => {
      const body = parseApiResponse<null>(res);
      expect(body.success).toBe(true);
      expect(body.code).toBe(201);
    });

  return agent;
}

describe('用户安全设置接口 (e2e)', () => {
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

  it('已登录用户修改密码后：旧密码失效，新密码生效', async () => {
    const phone = '13800138021';
    const userAgent = await registerUser(
      app,
      phone,
      'OldPass123',
      '修改密码用户',
    );

    const changePasswordRes = await userAgent
      .put('/api/users/me/password')
      .send({
        oldPassword: 'OldPass123',
        newPassword: 'NewPass123',
        confirmPassword: 'NewPass123',
      })
      .expect(200);

    expect(changePasswordRes.status).toBe(200);
    const changePasswordBody = parseApiResponse<null>(changePasswordRes);
    expect(changePasswordBody.success).toBe(true);
    expect(changePasswordBody.code).toBe(200);

    await request(getHttpServer(app))
      .post('/api/auth/login/password')
      .send({ phone, password: 'OldPass123' })
      .expect(401);

    await request(getHttpServer(app))
      .post('/api/auth/login/password')
      .send({ phone, password: 'NewPass123' })
      .expect(200);
  });

  it('同号换绑手机号应成功（不应误判为冲突）', async () => {
    const phone = '13800138022';
    const userAgent = await registerUser(
      app,
      phone,
      'Password123',
      '同号换绑用户',
    );

    await seedVerificationCode(
      app,
      phone,
      VerificationCodeType.BIND_PHONE,
      '654321',
    );

    const changeRes = await userAgent
      .put('/api/users/me/phone')
      .send({ newPhone: phone, smsCode: '654321' })
      .expect(200);

    const body = parseApiResponse<UserSelf>(changeRes);
    expect(body.data?.phone).toBe(phone);
  });

  it('换绑邮箱到已被他人占用的邮箱时返回 409', async () => {
    const userAAgent = await registerUser(
      app,
      '13800138023',
      'Password123',
      '用户A',
    );

    const userBAgent = await registerUser(
      app,
      '13800138024',
      'Password123',
      '用户B',
    );

    await seedVerificationCode(
      app,
      'taken@example.com',
      VerificationCodeType.BIND_EMAIL,
      '223344',
    );

    await userBAgent
      .put('/api/users/me/email')
      .send({ newEmail: 'taken@example.com', emailCode: '223344' })
      .expect(200);

    await seedVerificationCode(
      app,
      'taken@example.com',
      VerificationCodeType.BIND_EMAIL,
      '112233',
    );

    await userAAgent
      .put('/api/users/me/email')
      .send({ newEmail: 'taken@example.com', emailCode: '112233' })
      .expect(409)
      .expect((res: Response) => {
        const body = parseApiResponse<null>(res);
        expect(body.success).toBe(false);
        expect(body.code).toBe(409);
      });
  });
});

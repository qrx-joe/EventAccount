import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import {
  clearMutableData,
  closeE2eApp,
  createE2eApp,
  seedVerificationCode,
} from './e2e-helpers';
import { VerificationCodeType } from '../src/modules/verification/verification.dto';

function getHttpServer(app: INestApplication): App {
  return app.getHttpServer() as unknown as App;
}

/**
 * 注册用户并返回带 cookie 的 agent
 */
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
    .expect(201);
  return agent;
}

describe('S2: UUID 参数格式校验 (e2e)', () => {
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

  it('无效 UUID 访问公开资料返回 400', async () => {
    await request(getHttpServer(app))
      .get('/api/users/not-a-valid-uuid/profile')
      .expect(400);
  });

  it('纯数字 ID 访问公开资料返回 400', async () => {
    await request(getHttpServer(app))
      .get('/api/users/12345/profile')
      .expect(400);
  });

  it('合法 UUID 但用户不存在返回 404', async () => {
    await request(getHttpServer(app))
      .get('/api/users/01961234-5678-7000-8000-000000000000/profile')
      .expect(404);
  });

  it('无效 UUID 查询单个用户返回 400（需登录）', async () => {
    const agent = await registerUser(
      app,
      '13800138030',
      'Password123',
      'UUID测试用户',
    );

    await agent.get('/api/users/invalid-uuid').expect(400);
  });

  it('无效 UUID 更新用户返回 400（需登录）', async () => {
    const agent = await registerUser(
      app,
      '13800138031',
      'Password123',
      'UUID测试用户2',
    );

    await agent.put('/api/users/xxx').send({ nickname: '新昵称' }).expect(400);
  });

  it('无效 UUID 删除用户返回 400（需登录）', async () => {
    const agent = await registerUser(
      app,
      '13800138032',
      'Password123',
      'UUID测试用户3',
    );

    await agent.delete('/api/users/abc-not-uuid').expect(400);
  });
});

describe('S1: ThrottlerGuard 限流 (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await closeE2eApp(app);
  });

  it('修改密码接口连续请求超过 5 次后返回 429', async () => {
    await clearMutableData(app);

    const agent = await registerUser(
      app,
      '13800138040',
      'Password123',
      '限流测试用户',
    );

    // 发送 5 次请求（都会因旧密码错误而返回 400，但应被限流计数）
    for (let i = 0; i < 5; i++) {
      await agent
        .put('/api/users/me/password')
        .send({
          oldPassword: 'WrongPassword',
          newPassword: 'NewPass123',
          confirmPassword: 'NewPass123',
        })
        .expect(400);
    }

    // 第 6 次请求应被限流，返回 429
    const res = await agent.put('/api/users/me/password').send({
      oldPassword: 'WrongPassword',
      newPassword: 'NewPass123',
      confirmPassword: 'NewPass123',
    });

    expect(res.status).toBe(429);
  });

  it('GET /users/me 不受方法级限流影响（使用全局默认 60 次/分钟）', async () => {
    await clearMutableData(app);

    const agent = await registerUser(
      app,
      '13800138041',
      'Password123',
      '默认限流用户',
    );

    // 连续请求 10 次，不应触发限流（全局默认 60 次/分钟）
    for (let i = 0; i < 10; i++) {
      await agent.get('/api/users/me').expect(200);
    }
  });
});

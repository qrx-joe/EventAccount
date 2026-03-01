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

type Agreement = {
  id: string;
  type: 'user-terms' | 'privacy-policy' | 'payment-agreement';
  title: string;
  version: string;
  content: string;
  effectiveDate: string;
};

type AgreementSign = {
  id: string;
  userId: string;
  agreementType: 'user-terms' | 'privacy-policy' | 'payment-agreement';
  version: string;
  signedAt: string;
};

function getHttpServer(app: INestApplication): App {
  return app.getHttpServer() as unknown as App;
}

async function registerUser(
  app: INestApplication,
  phone: string,
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
    .send({
      phone,
      smsCode: '123456',
      password: 'Password123',
      nickname: '协议测试用户',
    })
    .expect(201);

  return agent;
}

describe('协议模块 (e2e)', () => {
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

  it('应能获取 payment-agreement 协议内容', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/agreements/payment-agreement')
      .expect(200);

    const body = parseApiResponse<Agreement>(res);
    expect(body.data?.type).toBe('payment-agreement');
    expect(body.data?.version).toBe('1.0.0');
    expect(typeof body.data?.content).toBe('string');
    expect(body.data?.content.length).toBeGreaterThan(10);
  });

  it('同一用户重复签署同一协议类型应保持单条记录（幂等）', async () => {
    const agent = await registerUser(app, '13800138111');

    const signRes = await agent
      .post('/api/agreements/sign')
      .send({ agreementType: 'payment-agreement' })
      .expect(201);

    const signBody = parseApiResponse<AgreementSign>(signRes);
    expect(signBody.data?.agreementType).toBe('payment-agreement');

    const signedRes1 = await agent.get('/api/agreements/signed').expect(200);
    const signedBody1 = parseApiResponse<AgreementSign[]>(signedRes1);
    const paymentSigns1 = (signedBody1.data ?? []).filter(
      (item) => item.agreementType === 'payment-agreement',
    );
    expect(paymentSigns1).toHaveLength(1);

    await agent
      .post('/api/agreements/sign')
      .send({ agreementType: 'payment-agreement' })
      .expect(201)
      .expect((res: Response) => {
        const body = parseApiResponse<AgreementSign>(res);
        expect(body.data?.agreementType).toBe('payment-agreement');
      });

    const signedRes2 = await agent.get('/api/agreements/signed').expect(200);
    const signedBody2 = parseApiResponse<AgreementSign[]>(signedRes2);
    const paymentSigns2 = (signedBody2.data ?? []).filter(
      (item) => item.agreementType === 'payment-agreement',
    );

    expect(paymentSigns2).toHaveLength(1);
  });
});

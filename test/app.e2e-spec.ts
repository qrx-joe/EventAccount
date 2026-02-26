import request from 'supertest';
import type { Response } from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { parseApiResponse } from './api-response-test-utils';
import { closeE2eApp, createE2eApp, clearMutableData } from './e2e-helpers';

function getHttpServer(app: INestApplication): App {
  return app.getHttpServer() as unknown as App;
}

describe('基础路由与响应规范 (e2e)', () => {
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

  it('GET /api/agreements/invalid-type 返回 400 且响应体结构统一', () => {
    return request(getHttpServer(app))
      .get('/api/agreements/invalid-type')
      .expect(400)
      .expect((res: Response) => {
        const body = parseApiResponse<null>(res);
        expect(body.success).toBe(false);
        expect(body.code).toBe(400);
        expect(typeof body.message).toBe('string');
        expect(body.data).toBeNull();
        expect(typeof body.timestamp).toBe('string');
      });
  });
});

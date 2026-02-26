/**
 * E2E 测试环境变量加载
 * Jest 默认 NODE_ENV=test，但项目只有 .env.dev，需要手动加载
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.dev') });

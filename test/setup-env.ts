import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const rootDir = path.resolve(__dirname, '..');
const testEnvPath = path.join(rootDir, '.env.test');
const devEnvPath = path.join(rootDir, '.env.dev');

const envPath = fs.existsSync(testEnvPath) ? testEnvPath : devEnvPath;
dotenv.config({ path: envPath });

process.env.NODE_ENV = 'test';

if (process.env.DB_DATABASE_TEST) {
  process.env.DB_DATABASE = process.env.DB_DATABASE_TEST;
}

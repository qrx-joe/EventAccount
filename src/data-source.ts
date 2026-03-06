import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载 .env.dev 文件
dotenv.config({ path: path.resolve(__dirname, '../.env.dev') });

const appDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 't3_program',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});

export default appDataSource;

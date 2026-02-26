import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import databaseConfig from './config/database.config';
import smsConfig from './config/sms.config';
import emailConfig from './config/email.config';
import redisConfig from './config/redis.config';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { VerificationModule } from './modules/verification/verification.module';
import { AgreementModule } from './modules/agreement/agreement.module';
@Module({
  imports: [
    // 全局配置模块，加载 .env 文件（环境专属文件优先，后加载的覆盖先加载的）
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, smsConfig, emailConfig, redisConfig],
      validationSchema: Joi.object({
        // 数据库
        DB_HOST: Joi.string().default('localhost'),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_DATABASE: Joi.string().required(),
        // JWT
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().default('7d'),
        // 应用
        PORT: Joi.number().default(3000),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        REDIS_HOST: Joi.string().default('127.0.0.1'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().allow('').default(''),
        REDIS_DB: Joi.number().default(0),
        OTP_STORE_BACKEND: Joi.string()
          .valid('memory', 'redis')
          .default('memory'),
      }),
    }),

    // TypeORM 数据库连接（异步读取配置）
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get<string>('NODE_ENV') !== 'production', // 生产环境禁止自动同步
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),

    // 全局速率限制：60 秒内最多 60 次请求
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),

    UserModule,
    AuthModule,
    VerificationModule,
    AgreementModule,
  ],
})
export class AppModule {}

import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { VerificationService } from '../src/modules/verification/verification.service';
import { VerificationCodeType } from '../src/modules/verification/verification.dto';

export async function createE2eApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();
  return app;
}

export async function clearMutableData(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  await dataSource.query(
    'TRUNCATE TABLE "agreement_signs", "users" RESTART IDENTITY CASCADE;',
  );

  const verificationService = app.get(VerificationService);
  await verificationService.clearCodesForTest();
}

export async function closeE2eApp(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
  await app.close();
}

export function seedVerificationCode(
  app: INestApplication,
  target: string,
  type: VerificationCodeType,
  code: string,
): Promise<void> {
  const verificationService = app.get(VerificationService);
  return verificationService.seedCodeForTest(target, type, code);
}

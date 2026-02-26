import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { VerificationCodeType } from '../verification.dto';
import { InMemoryVerificationStore } from './in-memory-verification.store';
import { RedisVerificationStore } from './redis-verification.store';
import { StoredCodeEntry, VerificationStore } from './verification-store.types';

@Injectable()
export class VerificationStoreGateway
  implements VerificationStore, OnModuleDestroy
{
  private readonly backend: VerificationStore;

  constructor(private readonly configService: ConfigService) {
    const storeBackend =
      this.configService.get<string>('redis.otpStoreBackend') || 'memory';

    if (storeBackend === 'redis') {
      const redis = new Redis({
        host: this.configService.get<string>('redis.host') || '127.0.0.1',
        port: this.configService.get<number>('redis.port') || 6379,
        password: this.configService.get<string>('redis.password') || undefined,
        db: this.configService.get<number>('redis.db') || 0,
        lazyConnect: false,
        maxRetriesPerRequest: 2,
      });
      this.backend = new RedisVerificationStore(redis);
      return;
    }

    this.backend = new InMemoryVerificationStore();
  }

  async getRateLimitRemainingMs(key: string): Promise<number> {
    return this.backend.getRateLimitRemainingMs(key);
  }

  async setRateLimit(key: string, ttlMs: number): Promise<void> {
    await this.backend.setRateLimit(key, ttlMs);
  }

  async saveCode(key: string, code: string, ttlMs: number): Promise<void> {
    await this.backend.saveCode(key, code, ttlMs);
  }

  async getCodeEntry(key: string): Promise<StoredCodeEntry | null> {
    return this.backend.getCodeEntry(key);
  }

  async incrementAttempts(key: string): Promise<number> {
    return this.backend.incrementAttempts(key);
  }

  async deleteCode(key: string): Promise<void> {
    await this.backend.deleteCode(key);
  }

  async clearAllForTest(): Promise<void> {
    await this.backend.clearAllForTest();
  }

  async seedCodeForTest(
    target: string,
    type: VerificationCodeType,
    code: string,
    ttlMs: number,
  ): Promise<void> {
    await this.backend.seedCodeForTest(target, type, code, ttlMs);
  }

  async close(): Promise<void> {
    await this.backend.close();
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}

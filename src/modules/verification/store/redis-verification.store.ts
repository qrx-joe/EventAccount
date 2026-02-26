import Redis from 'ioredis';
import { VerificationCodeType } from '../verification.dto';
import { VerificationStore, StoredCodeEntry } from './verification-store.types';

const CODE_PREFIX = 'verify:code:';
const RATE_PREFIX = 'verify:rate:';

export class RedisVerificationStore implements VerificationStore {
  constructor(private readonly redis: Redis) {}

  private codeKey(key: string): string {
    return `${CODE_PREFIX}${key}`;
  }

  private rateKey(key: string): string {
    return `${RATE_PREFIX}${key}`;
  }

  private parseNumber(value: string | null): number {
    if (!value) {
      return 0;
    }
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  async getRateLimitRemainingMs(key: string): Promise<number> {
    const ttl = await this.redis.pttl(this.rateKey(key));
    return ttl > 0 ? ttl : 0;
  }

  async setRateLimit(key: string, ttlMs: number): Promise<void> {
    await this.redis.set(this.rateKey(key), '1', 'PX', ttlMs);
  }

  async saveCode(key: string, code: string, ttlMs: number): Promise<void> {
    const redisKey = this.codeKey(key);
    await this.redis
      .multi()
      .hset(redisKey, {
        code,
        attempts: '0',
      })
      .pexpire(redisKey, ttlMs)
      .exec();
  }

  async getCodeEntry(key: string): Promise<StoredCodeEntry | null> {
    const data = await this.redis.hgetall(this.codeKey(key));
    if (!data.code) {
      return null;
    }
    return {
      code: data.code,
      attempts: this.parseNumber(data.attempts),
    };
  }

  async incrementAttempts(key: string): Promise<number> {
    return this.redis.hincrby(this.codeKey(key), 'attempts', 1);
  }

  async deleteCode(key: string): Promise<void> {
    await this.redis.del(this.codeKey(key));
  }

  async clearAllForTest(): Promise<void> {
    const codeKeys = await this.redis.keys(`${CODE_PREFIX}*`);
    const rateKeys = await this.redis.keys(`${RATE_PREFIX}*`);
    const allKeys = [...codeKeys, ...rateKeys];
    if (allKeys.length > 0) {
      await this.redis.del(...allKeys);
    }
  }

  async seedCodeForTest(
    target: string,
    type: VerificationCodeType,
    code: string,
    ttlMs: number,
  ): Promise<void> {
    const key = `${target}:${type}`;
    await this.saveCode(key, code, ttlMs);
    await this.redis.del(this.rateKey(key));
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

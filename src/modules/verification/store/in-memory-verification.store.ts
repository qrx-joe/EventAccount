import { VerificationCodeType } from '../verification.dto';
import { VerificationStore, StoredCodeEntry } from './verification-store.types';

type InMemoryCodeEntry = StoredCodeEntry & {
  expiresAt: number;
};

export class InMemoryVerificationStore implements VerificationStore {
  private readonly codeStore = new Map<string, InMemoryCodeEntry>();
  private readonly rateLimitStore = new Map<string, number>();

  private isExpired(expiresAt: number): boolean {
    return Date.now() > expiresAt;
  }

  getRateLimitRemainingMs(key: string): Promise<number> {
    const nextAllowedAt = this.rateLimitStore.get(key);
    if (!nextAllowedAt) {
      return Promise.resolve(0);
    }
    if (this.isExpired(nextAllowedAt)) {
      this.rateLimitStore.delete(key);
      return Promise.resolve(0);
    }
    return Promise.resolve(nextAllowedAt - Date.now());
  }

  setRateLimit(key: string, ttlMs: number): Promise<void> {
    this.rateLimitStore.set(key, Date.now() + ttlMs);
    return Promise.resolve();
  }

  saveCode(key: string, code: string, ttlMs: number): Promise<void> {
    this.codeStore.set(key, {
      code,
      attempts: 0,
      expiresAt: Date.now() + ttlMs,
    });
    return Promise.resolve();
  }

  getCodeEntry(key: string): Promise<StoredCodeEntry | null> {
    const entry = this.codeStore.get(key);
    if (!entry) {
      return Promise.resolve(null);
    }
    if (this.isExpired(entry.expiresAt)) {
      this.codeStore.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve({
      code: entry.code,
      attempts: entry.attempts,
    });
  }

  incrementAttempts(key: string): Promise<number> {
    const entry = this.codeStore.get(key);
    if (!entry) {
      return Promise.resolve(0);
    }
    if (this.isExpired(entry.expiresAt)) {
      this.codeStore.delete(key);
      return Promise.resolve(0);
    }
    entry.attempts += 1;
    return Promise.resolve(entry.attempts);
  }

  deleteCode(key: string): Promise<void> {
    this.codeStore.delete(key);
    return Promise.resolve();
  }

  clearAllForTest(): Promise<void> {
    this.codeStore.clear();
    this.rateLimitStore.clear();
    return Promise.resolve();
  }

  async seedCodeForTest(
    target: string,
    type: VerificationCodeType,
    code: string,
    ttlMs: number,
  ): Promise<void> {
    const key = `${target}:${type}`;
    await this.saveCode(key, code, ttlMs);
    this.rateLimitStore.delete(key);
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }
}

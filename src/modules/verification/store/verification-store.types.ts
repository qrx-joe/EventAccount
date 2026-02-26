import { VerificationCodeType } from '../verification.dto';

export type StoredCodeEntry = {
  code: string;
  attempts: number;
};

export interface VerificationStore {
  getRateLimitRemainingMs(key: string): Promise<number>;
  setRateLimit(key: string, ttlMs: number): Promise<void>;
  saveCode(key: string, code: string, ttlMs: number): Promise<void>;
  getCodeEntry(key: string): Promise<StoredCodeEntry | null>;
  incrementAttempts(key: string): Promise<number>;
  deleteCode(key: string): Promise<void>;
  clearAllForTest(): Promise<void>;
  seedCodeForTest(
    target: string,
    type: VerificationCodeType,
    code: string,
    ttlMs: number,
  ): Promise<void>;
  close(): Promise<void>;
}

export const VERIFICATION_STORE_TOKEN = Symbol('VERIFICATION_STORE_TOKEN');

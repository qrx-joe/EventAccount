import type { Response } from 'supertest';

export type ApiResponseBody<T> = {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  timestamp: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new Error(`响应体字段 ${key} 不是 boolean`);
  }
  return value;
}

function getNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number') {
    throw new Error(`响应体字段 ${key} 不是 number`);
  }
  return value;
}

function getString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`响应体字段 ${key} 不是 string`);
  }
  return value;
}

export function parseApiResponse<T>(response: Response): ApiResponseBody<T> {
  const body = (response as unknown as { body: unknown }).body;
  if (!isRecord(body)) {
    throw new Error('响应体不是对象');
  }

  const rawData = body.data;
  const data = (rawData === undefined ? null : rawData) as T | null;

  return {
    success: getBoolean(body, 'success'),
    code: getNumber(body, 'code'),
    message: getString(body, 'message'),
    data,
    timestamp: getString(body, 'timestamp'),
  };
}

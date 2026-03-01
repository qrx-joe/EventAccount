/** 时间单位到毫秒的映射 */
const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
  y: 31_536_000_000,
};

const DEFAULT_MS = 7 * 86_400_000; // 7d

/**
 * 将简写时间字符串（如 '7d', '24h', '30m'）转为毫秒
 * 无法解析时返回默认值 7 天
 */
export function parseDurationMs(raw: string | undefined): number {
  if (!raw) return DEFAULT_MS;
  const match = raw.match(/^(\d+)([smhdwy])$/);
  if (!match) return DEFAULT_MS;
  return parseInt(match[1], 10) * (UNIT_MS[match[2]] ?? DEFAULT_MS);
}

export const UNIX_MILLISECONDS = 1_000;

export function toUnixSeconds(date: Date): number {
  assertValidDate(date);
  return Math.floor(date.getTime() / UNIX_MILLISECONDS);
}

export function fromUnixSeconds(seconds: number): Date {
  if (!Number.isFinite(seconds)) {
    throw new TypeError('Unix timestamp phải là số hữu hạn');
  }

  return new Date(seconds * UNIX_MILLISECONDS);
}

export function addMilliseconds(date: Date, milliseconds: number): Date {
  assertValidDate(date);

  if (!Number.isFinite(milliseconds)) {
    throw new TypeError('milliseconds phải là số hữu hạn');
  }

  return new Date(date.getTime() + milliseconds);
}

export function addSeconds(date: Date, seconds: number): Date {
  return addMilliseconds(date, seconds * 1_000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return addSeconds(date, minutes * 60);
}

export function addHours(date: Date, hours: number): Date {
  return addMinutes(date, hours * 60);
}

export function addDays(date: Date, days: number): Date {
  return addHours(date, days * 24);
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  assertValidDate(expiresAt);
  assertValidDate(now);
  return expiresAt.getTime() <= now.getTime();
}

export function startOfUtcDay(date: Date): Date {
  assertValidDate(date);

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function endOfUtcDay(date: Date): Date {
  const start = startOfUtcDay(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1_000 - 1);
}

export function parseIsoDate(value: string): Date | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function assertValidDate(date: Date): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('Date không hợp lệ');
  }
}

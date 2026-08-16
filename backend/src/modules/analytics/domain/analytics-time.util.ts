export function analyticsDateKey(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function analyticsDate(value: Date, timeZone: string): Date {
  return new Date(`${analyticsDateKey(value, timeZone)}T00:00:00.000Z`);
}

export function parseAnalyticsDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function dateKeyFromUtcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addUtcDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

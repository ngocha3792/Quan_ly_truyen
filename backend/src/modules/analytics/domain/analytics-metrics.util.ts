export interface AnalyticsTotals {
  views: number;
  uniqueReaders: number;
  readingStarts: number;
  completions: number;
  completionRate: number | null;
  readingSeconds: number;
}

export function completionRate(completions: number, starts: number): number | null {
  if (starts <= 0) return null;
  return Math.round((completions / starts) * 10_000) / 10_000;
}

export function safeBigInt(value: bigint | number): number {
  const number = typeof value === 'bigint' ? Number(value) : value;
  return Number.isFinite(number) ? number : 0;
}

export interface AnalyticsTotals {
  views: number;
  uniqueReaders: number;
  readingStarts: number;
  completions: number;
  completionRate: number | null;
  readingStartRate: number | null;
  readingSeconds: number;
  averageReadingSecondsPerReaderDay: number | null;
}

export interface AnalyticsCounters {
  views: number;
  uniqueReaders: number;
  readingStarts: number;
  completions: number;
  readingSeconds: number;
}

export function derivedAnalyticsMetrics(
  value: AnalyticsCounters,
): Pick<
  AnalyticsTotals,
  'completionRate' | 'readingStartRate' | 'averageReadingSecondsPerReaderDay'
> {
  return {
    completionRate: ratio(value.completions, value.readingStarts),
    readingStartRate: ratio(value.readingStarts, value.views),
    averageReadingSecondsPerReaderDay: average(
      value.readingSeconds,
      value.uniqueReaders,
    ),
  };
}

export function completionRate(
  completions: number,
  starts: number,
): number | null {
  return ratio(completions, starts);
}

export function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10_000) / 10_000;
}

export function average(total: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round((total / count) * 100) / 100;
}

export function safeBigInt(value: bigint | number): number {
  const number = typeof value === 'bigint' ? Number(value) : value;
  return Number.isFinite(number) ? number : 0;
}

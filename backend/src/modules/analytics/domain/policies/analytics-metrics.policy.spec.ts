import {
  average,
  completionRate,
  derivedAnalyticsMetrics,
  ratio,
  safeBigInt,
} from './analytics-metrics.policy';

describe('analytics metrics policy', () => {
  it('derives engagement metrics from recorded counters', () => {
    expect(
      derivedAnalyticsMetrics({
        views: 20,
        uniqueReaders: 4,
        readingStarts: 10,
        completions: 3,
        readingSeconds: 125,
      }),
    ).toEqual({
      completionRate: 0.3,
      readingStartRate: 0.5,
      averageReadingSecondsPerReaderDay: 31.25,
    });
  });

  it('returns null when a derived metric has no real denominator', () => {
    expect(completionRate(2, 0)).toBeNull();
    expect(ratio(2, 0)).toBeNull();
    expect(average(120, 0)).toBeNull();
  });

  it('does not clamp a real ratio to manufacture a nicer funnel', () => {
    expect(ratio(3, 2)).toBe(1.5);
  });

  it('converts persisted bigint counters without throwing', () => {
    expect(safeBigInt(12n)).toBe(12);
    expect(safeBigInt(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

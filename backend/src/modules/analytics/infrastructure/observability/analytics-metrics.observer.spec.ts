import { AnalyticsMetricsObserver } from './analytics-metrics.observer';

describe('AnalyticsMetricsObserver', () => {
  const now = new Date('2026-09-07T12:00:00.000Z');

  it('publishes database backlog and a healthy reconciliation heartbeat', async () => {
    const prisma = {
      readerAnalyticsEvent: {
        count: jest.fn().mockResolvedValue(3),
        findFirst: jest
          .fn()
          .mockResolvedValue({ receivedAt: new Date(now.getTime() - 120_000) }),
      },
    };
    const metrics = createMetrics();
    const redis = {
      get: jest.fn().mockResolvedValue(String(now.getTime() - 300_000)),
    };
    const observer = new AnalyticsMetricsObserver(
      prisma as never,
      createConfig(true) as never,
      metrics as never,
      redis as never,
    );

    await observer.collect(now);

    expect(metrics.setReaderAnalyticsHealth).toHaveBeenCalledWith({
      enabled: true,
      backlogEvents: 3,
      oldestUnprocessedAgeSeconds: 120,
      reconciliationHealthy: true,
      reconciliationAgeSeconds: 300,
    });
  });

  it('reports an invalid or expired heartbeat as unhealthy', async () => {
    const prisma = {
      readerAnalyticsEvent: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const metrics = createMetrics();
    const observer = new AnalyticsMetricsObserver(
      prisma as never,
      createConfig(true) as never,
      metrics as never,
      { get: jest.fn().mockResolvedValue('invalid') } as never,
    );

    await observer.collect(now);

    expect(metrics.setReaderAnalyticsHealth).toHaveBeenCalledWith({
      enabled: true,
      backlogEvents: 0,
      oldestUnprocessedAgeSeconds: 0,
      reconciliationHealthy: false,
      reconciliationAgeSeconds: 0,
    });
  });

  it('does not query dependencies when analytics is disabled', async () => {
    const prisma = {
      readerAnalyticsEvent: {
        count: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    const metrics = createMetrics();
    const redis = { get: jest.fn() };
    const observer = new AnalyticsMetricsObserver(
      prisma as never,
      createConfig(false) as never,
      metrics as never,
      redis as never,
    );

    await observer.collect(now);

    expect(prisma.readerAnalyticsEvent.count).not.toHaveBeenCalled();
    expect(redis.get).not.toHaveBeenCalled();
    expect(metrics.setReaderAnalyticsHealth).toHaveBeenCalledWith({
      enabled: false,
      backlogEvents: 0,
      oldestUnprocessedAgeSeconds: 0,
      reconciliationHealthy: true,
      reconciliationAgeSeconds: 0,
    });
  });

  it('marks the snapshot unhealthy instead of leaving a stale success visible', async () => {
    const metrics = createMetrics();
    const observer = new AnalyticsMetricsObserver(
      {
        readerAnalyticsEvent: {
          count: jest.fn().mockRejectedValue(new Error('database unavailable')),
          findFirst: jest.fn(),
        },
      } as never,
      createConfig(true) as never,
      metrics as never,
      { get: jest.fn() } as never,
    );

    await observer.collect(now);

    expect(metrics.setReaderAnalyticsEnabled).toHaveBeenCalledWith(true);
    expect(metrics.setReaderAnalyticsSnapshotHealthy).toHaveBeenCalledWith(
      false,
    );
  });
});

function createMetrics() {
  return {
    isEnabled: jest.fn().mockReturnValue(true),
    setReaderAnalyticsHealth: jest.fn(),
    setReaderAnalyticsEnabled: jest.fn(),
    setReaderAnalyticsSnapshotHealthy: jest.fn(),
  };
}

function createConfig(enabled: boolean) {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'analytics') return { enabled };
      return { metrics: { snapshotIntervalMs: 15_000 } };
    }),
  };
}

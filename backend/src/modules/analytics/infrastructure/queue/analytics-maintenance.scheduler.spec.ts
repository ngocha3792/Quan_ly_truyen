import {
  ANALYTICS_RECONCILIATION_HEARTBEAT_KEY,
  ANALYTICS_RECONCILIATION_HEARTBEAT_TTL_SECONDS,
} from '../observability/analytics-health.constants';
import { AnalyticsMaintenanceScheduler } from './analytics-maintenance.scheduler';

describe('AnalyticsMaintenanceScheduler', () => {
  const now = new Date('2026-09-07T12:00:00.000Z');

  it('writes a heartbeat only after the maintenance cycle succeeds', async () => {
    const reconciliation = createReconciliation();
    const redis = { set: jest.fn().mockResolvedValue('OK') };
    const scheduler = new AnalyticsMaintenanceScheduler(
      createConfig() as never,
      reconciliation as never,
      redis as never,
    );

    await scheduler.tick(now);

    expect(reconciliation.recomputeUniqueReaders).toHaveBeenNthCalledWith(
      1,
      '2026-09-07',
    );
    expect(reconciliation.recomputeUniqueReaders).toHaveBeenNthCalledWith(
      2,
      '2026-09-06',
    );
    expect(reconciliation.reconcileSettledDate).toHaveBeenCalledWith(
      '2026-09-05',
    );
    expect(reconciliation.cleanupProcessedBatch).toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledWith(
      ANALYTICS_RECONCILIATION_HEARTBEAT_KEY,
      expect.stringMatching(/^\d+$/u),
      'EX',
      ANALYTICS_RECONCILIATION_HEARTBEAT_TTL_SECONDS,
    );
  });

  it('does not publish a successful heartbeat after reconciliation fails', async () => {
    const reconciliation = createReconciliation();
    reconciliation.recomputeUniqueReaders.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    const redis = { set: jest.fn() };
    const scheduler = new AnalyticsMaintenanceScheduler(
      createConfig() as never,
      reconciliation as never,
      redis as never,
    );

    await expect(scheduler.tick(now)).rejects.toThrow('database unavailable');
    expect(redis.set).not.toHaveBeenCalled();
  });
});

function createConfig() {
  return {
    getOrThrow: jest.fn().mockReturnValue({
      enabled: true,
      timeZone: 'Asia/Ho_Chi_Minh',
    }),
  };
}

function createReconciliation() {
  return {
    recomputeUniqueReaders: jest.fn().mockResolvedValue(undefined),
    reconcileSettledDate: jest.fn().mockResolvedValue(true),
    cleanupProcessedBatch: jest.fn().mockResolvedValue(0),
  };
}

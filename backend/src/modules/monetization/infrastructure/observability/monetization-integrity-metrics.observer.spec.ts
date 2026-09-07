import { MonetizationIntegrityMetricsObserver } from './monetization-integrity-metrics.observer';

describe('MonetizationIntegrityMetricsObserver', () => {
  it('publishes bounded integrity counts', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          ledgerBalance: 0n,
          walletBalance: 1n,
          chapterPurchase: 2n,
          paymentOrder: 0n,
          paymentWebhookPending: 3n,
          paymentWebhookProcessing: 1n,
          paymentWebhookFailed: 0n,
          paymentWebhookOldestSeconds: 45,
        },
      ]),
    };
    const metrics = {
      setMonetizationRollout: jest.fn(),
      setMonetizationFinancialIntegrity: jest.fn(),
      setMonetizationIntegritySnapshotHealthy: jest.fn(),
      setPaymentWebhookBacklog: jest.fn(),
    };
    const observer = new MonetizationIntegrityMetricsObserver(
      prisma as never,
      metrics as never,
      {
        enabled: true,
        rolloutStage: 'internal',
        integrityMetricsIntervalMs: 60_000,
      } as never,
    );

    await observer.refresh();

    expect(metrics.setMonetizationFinancialIntegrity).toHaveBeenCalledWith({
      ledger_balance: 0,
      wallet_balance: 1,
      chapter_purchase: 2,
      payment_order: 0,
    });
    expect(metrics.setPaymentWebhookBacklog).toHaveBeenCalledWith({
      pending: 3,
      processing: 1,
      failed: 0,
      oldestPendingAgeSeconds: 45,
    });
  });

  it('marks the snapshot unhealthy without logging raw database errors', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('secret')),
    };
    const metrics = {
      setMonetizationRollout: jest.fn(),
      setMonetizationFinancialIntegrity: jest.fn(),
      setMonetizationIntegritySnapshotHealthy: jest.fn(),
      setPaymentWebhookBacklog: jest.fn(),
    };
    const observer = new MonetizationIntegrityMetricsObserver(
      prisma as never,
      metrics as never,
      {
        enabled: true,
        rolloutStage: 'internal',
        integrityMetricsIntervalMs: 60_000,
      } as never,
    );

    await observer.refresh();

    expect(
      metrics.setMonetizationIntegritySnapshotHealthy,
    ).toHaveBeenCalledWith(false);
  });
});

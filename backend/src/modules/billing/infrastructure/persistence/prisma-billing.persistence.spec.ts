import { Prisma } from '@/generated/prisma/client';

import { PrismaBillingPersistence } from './prisma-billing.persistence';

const event = {
  eventId: 'provider-event-1',
  type: 'payment.succeeded' as const,
  orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  providerReference: 'provider-reference-1',
  amountMinor: '50000',
  currency: 'VND',
  occurredAt: '2026-09-07T12:00:00.000Z',
};

describe('PrismaBillingPersistence webhook inbox', () => {
  const prisma = {
    inboundWebhookEvent: { create: jest.fn(), findUnique: jest.fn() },
  };
  const persistence = new PrismaBillingPersistence(
    prisma as never,
    {} as never,
    { get: () => undefined } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.inboundWebhookEvent.create.mockResolvedValue({});
    prisma.inboundWebhookEvent.findUnique.mockResolvedValue(null);
  });

  it('acknowledges an exact duplicate event', async () => {
    prisma.inboundWebhookEvent.create.mockRejectedValue(duplicateError());
    prisma.inboundWebhookEvent.findUnique.mockResolvedValue({
      payloadHash: 'a'.repeat(64),
    });

    await expect(
      persistence.receiveWebhookEvent({
        provider: 'hmac-sandbox',
        event,
        payloadHash: 'a'.repeat(64),
      }),
    ).resolves.toEqual({ duplicate: true });
  });

  it('rejects a reused event id carrying a different payload', async () => {
    prisma.inboundWebhookEvent.create.mockRejectedValue(duplicateError());
    prisma.inboundWebhookEvent.findUnique.mockResolvedValue({
      payloadHash: 'b'.repeat(64),
    });

    await expect(
      persistence.receiveWebhookEvent({
        provider: 'hmac-sandbox',
        event,
        payloadHash: 'a'.repeat(64),
      }),
    ).rejects.toThrow('payload khác');
  });
});

function duplicateError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('duplicate webhook', {
    code: 'P2002',
    clientVersion: '7.9.1',
  });
}

describe('PrismaBillingPersistence reconcile', () => {
  function persistenceWith(timeZone: string | undefined, row: unknown) {
    const $queryRaw = jest.fn().mockResolvedValue(row === null ? [] : [row]);
    const persistence = new PrismaBillingPersistence(
      { $queryRaw } as never,
      {} as never,
      { get: () => (timeZone ? { timeZone } : undefined) } as never,
    );
    return { persistence, $queryRaw };
  }

  const row = {
    paidOrders: 12n,
    paidOrdersWithoutLedger: 0n,
    orphanTopUpTransactions: 0n,
    pendingExpiredOrders: 2n,
    awaitingReviewOrders: 18n,
    awaitingReviewOlderThan24h: 3n,
    awaitingReviewAmountMinor: 42_500_000n,
    confirmedToday: 27n,
  };

  it('trả tổng tiền chờ duyệt dạng chuỗi để không mất chính xác vì BigInt', async () => {
    const { persistence } = persistenceWith('Asia/Ho_Chi_Minh', row);

    await expect(persistence.reconcile()).resolves.toMatchObject({
      awaitingReviewOrders: 18,
      awaitingReviewOlderThan24h: 3,
      awaitingReviewAmountMinor: '42500000',
      confirmedToday: 27,
    });
  });

  it('cắt mốc "hôm nay" theo múi giờ vận hành chứ không theo UTC', async () => {
    const { persistence, $queryRaw } = persistenceWith('Asia/Ho_Chi_Minh', row);

    await persistence.reconcile();

    const [statement] = $queryRaw.mock.calls[0] as [Prisma.Sql];
    expect(statement.values).toContain('Asia/Ho_Chi_Minh');
  });

  it('dùng múi giờ Việt Nam khi cấu hình analytics chưa được nạp', async () => {
    const { persistence, $queryRaw } = persistenceWith(undefined, row);

    await persistence.reconcile();

    const [statement] = $queryRaw.mock.calls[0] as [Prisma.Sql];
    expect(statement.values).toContain('Asia/Ho_Chi_Minh');
  });

  it('coi bảng rỗng là số không thay vì vỡ', async () => {
    const { persistence } = persistenceWith('Asia/Ho_Chi_Minh', null);

    await expect(persistence.reconcile()).resolves.toMatchObject({
      awaitingReviewOrders: 0,
      awaitingReviewAmountMinor: '0',
      confirmedToday: 0,
    });
  });
});

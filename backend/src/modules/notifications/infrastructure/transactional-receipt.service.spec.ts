import type { Prisma } from '@/generated/prisma/client';
import type { CreateOutboxEventInput } from '@/infrastructure/queue/outbox';

import { TransactionalReceiptService } from './transactional-receipt.service';

describe('TransactionalReceiptService', () => {
  const config = {
    getOrThrow: jest.fn(() => ({
      enabled: true,
      frontendPublicUrl: 'https://103.74.100.55.nip.io/',
    })),
  };
  let capturedOutboxInput: CreateOutboxEventInput | undefined;
  const createOutbox = jest.fn(
    (_transaction: Prisma.TransactionClient, input: CreateOutboxEventInput) => {
      capturedOutboxInput = input;
      return Promise.resolve({ id: 'outbox-1' });
    },
  );
  const outboxWriter = { create: createOutbox };
  const tx = {
    user: { findFirst: jest.fn() },
    notification: { upsert: jest.fn() },
    outboxEvent: { findUnique: jest.fn() },
  };
  const service = new TransactionalReceiptService(
    config as never,
    outboxWriter as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    capturedOutboxInput = undefined;
    tx.user.findFirst.mockResolvedValue({
      email: 'reader@example.com',
      displayName: 'Reader',
      emailVerifiedAt: new Date(),
      notificationPreference: { inAppEnabled: true, emailEnabled: true },
    });
    tx.outboxEvent.findUnique.mockResolvedValue(null);
    tx.notification.upsert.mockResolvedValue({});
  });

  it('creates a deduplicated in-app receipt and encrypted-mail outbox input', async () => {
    await service.enqueue(tx as never, {
      userId: '11111111-1111-4111-8111-111111111111',
      dedupeKey: 'chapter-purchase:purchase-1',
      type: 'chapter_purchase',
      title: 'Mua chương thành công',
      body: '25 Credit đã được ghi nhận.',
      tag: 'Mua chương',
      transactionId: 'transaction-1',
      amountCredits: 25n,
    });

    expect(tx.notification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dedupeKey: 'chapter-purchase:purchase-1' },
      }),
    );
    const payload = capturedOutboxInput?.payload as {
      variables?: { amountCredits?: string };
    };
    expect(capturedOutboxInput?.aggregateType).toBe('mail');
    expect(capturedOutboxInput?.idempotencyKey).toBe(
      'chapter-purchase:purchase-1:email',
    );
    expect(payload.variables?.amountCredits).toBe('25');
  });

  it('honors disabled user channels', async () => {
    tx.user.findFirst.mockResolvedValue({
      email: 'reader@example.com',
      displayName: 'Reader',
      emailVerifiedAt: new Date(),
      notificationPreference: { inAppEnabled: false, emailEnabled: false },
    });

    await service.enqueue(tx as never, {
      userId: '11111111-1111-4111-8111-111111111111',
      dedupeKey: 'chapter-refund:purchase-1',
      type: 'chapter_refund',
      title: 'Hoàn Credit',
      body: '25 Credit đã được hoàn.',
      tag: 'Hoàn Credit',
      transactionId: 'transaction-2',
      amountCredits: 25n,
    });

    expect(tx.notification.upsert).not.toHaveBeenCalled();
    expect(createOutbox).not.toHaveBeenCalled();
  });
});

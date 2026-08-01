import { OutboxStatus } from '@/generated/prisma/client';

import { OutboxWriterService } from './outbox-writer.service';

describe('OutboxWriterService', () => {
  const writer = new OutboxWriterService();

  it('creates a pending event through the supplied transaction client', async () => {
    const availableAt = new Date('2026-08-02T01:00:00Z');
    const tx = transactionClient();

    await expect(
      writer.create(tx as never, {
        aggregateType: 'mail',
        aggregateId: 'user-1',
        eventType: 'mail.send.v1',
        payload: { version: 1, recipient: 'reader@example.test' },
        availableAt,
      }),
    ).resolves.toEqual({ id: 'event-1' });

    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        aggregateType: 'mail',
        aggregateId: 'user-1',
        eventType: 'mail.send.v1',
        payload: { version: 1, recipient: 'reader@example.test' },
        status: OutboxStatus.PENDING,
        availableAt,
      },
      select: { id: true },
    });
  });

  it('uses a current default availableAt and has no root Prisma dependency', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-02T02:00:00Z'));
    try {
      const tx = transactionClient();
      await writer.create(tx as never, {
        aggregateType: 'mail',
        aggregateId: 'user-2',
        eventType: 'mail.send.v1',
        payload: {},
      });

      const calls = tx.outboxEvent.create.mock.calls as unknown as Array<
        [{ data: { availableAt: Date } }]
      >;
      expect(calls[0][0].data.availableAt).toEqual(
        new Date('2026-08-02T02:00:00Z'),
      );
      expect(OutboxWriterService.length).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

function transactionClient() {
  return {
    outboxEvent: {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
    },
  };
}

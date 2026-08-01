/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { ConfigService } from '@nestjs/config';

import { OutboxStatus } from '@/generated/prisma/enums';

import { OutboxDispatcherService } from './outbox-dispatcher.service';

describe('OutboxDispatcherService', () => {
  let service: OutboxDispatcherService;
  let prisma: {
    outboxEvent: { updateMany: jest.Mock; findMany: jest.Mock };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let queue: { add: jest.Mock };

  beforeEach(() => {
    prisma = {
      outboxEvent: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma),
    );
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    service = createService(prisma, queue);
  });

  it('returns zero when no event is atomically claimed', async () => {
    await expect(service.dispatchBatch()).resolves.toBe(0);
    const sql = prisma.$queryRaw.mock.calls[0]?.[0] as {
      strings?: readonly string[];
    };
    expect(sql.strings?.join('')).toContain('FOR UPDATE SKIP LOCKED');
  });

  it('publishes only IDs returned by the atomic claim', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'claimed' }]);
    prisma.outboxEvent.findMany.mockResolvedValue([
      event({ id: 'claimed' }),
      event({ id: 'not-claimed' }),
    ]);

    await expect(service.dispatchBatch()).resolves.toBe(1);

    expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['claimed'] } },
    });
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ outboxEventId: 'claimed' }),
      { jobId: 'outbox-claimed' },
    );
  });

  it('keeps competing claim batches disjoint', async () => {
    const allEvents = [event({ id: 'a' }), event({ id: 'b' })];
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: 'a' }])
      .mockResolvedValueOnce([{ id: 'b' }]);
    prisma.outboxEvent.findMany.mockImplementation(
      (args: { where: { id: { in: string[] } } }) =>
        Promise.resolve(
          allEvents.filter((candidate) =>
            args.where.id.in.includes(candidate.id),
          ),
        ),
    );

    await Promise.all([service.dispatchBatch(1), service.dispatchBatch(1)]);

    const publishedIds = queue.add.mock.calls.map(
      (call: unknown[]) => (call[1] as { outboxEventId: string }).outboxEventId,
    );
    expect(new Set(publishedIds)).toEqual(new Set(['a', 'b']));
    expect(publishedIds).toHaveLength(2);
  });

  it('recovers stale processing events without incrementing attempts', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'recovered' }]);
    prisma.outboxEvent.findMany.mockResolvedValue([event({ id: 'recovered' })]);

    await service.dispatchBatch();

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: OutboxStatus.PROCESSING,
          processingStartedAt: { lte: expect.any(Date) },
        }),
        data: expect.objectContaining({
          status: OutboxStatus.PENDING,
          processingStartedAt: null,
          lastError: 'Recovered stale PROCESSING outbox event',
        }),
      }),
    );
    const recoveryData = prisma.outboxEvent.updateMany.mock.calls[0][0]
      .data as Record<string, unknown>;
    expect(recoveryData).not.toHaveProperty('attempts');
  });

  it('uses the configured timeout cutoff so recent processing rows are untouched', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
    try {
      await service.dispatchBatch();
      const recoveryWhere = prisma.outboxEvent.updateMany.mock.calls[0][0]
        .where as { processingStartedAt: { lte: Date } };
      expect(recoveryWhere.processingStartedAt.lte).toEqual(
        new Date('2026-08-01T11:59:00Z'),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('clears processing state after publishing', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'published' }]);
    prisma.outboxEvent.findMany.mockResolvedValue([event({ id: 'published' })]);
    await service.dispatchBatch();
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'published', status: OutboxStatus.PROCESSING },
      data: expect.objectContaining({
        status: OutboxStatus.PUBLISHED,
        processingStartedAt: null,
        lastError: null,
      }),
    });
  });

  it('returns retryable failures to pending and truncates the error', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'retry' }]);
    prisma.outboxEvent.findMany.mockResolvedValue([event({ id: 'retry' })]);
    queue.add.mockRejectedValue(new Error('x'.repeat(1000)));
    await service.dispatchBatch();
    const retryCall = prisma.outboxEvent.updateMany.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { data?: { attempts?: number } }).data?.attempts === 1,
    ) as [
      {
        data: {
          status: OutboxStatus;
          lastError: string;
          processingStartedAt: null;
        };
      },
    ];
    expect(retryCall[0].data.status).toBe(OutboxStatus.PENDING);
    expect(retryCall[0].data.processingStartedAt).toBeNull();
    expect(retryCall[0].data.lastError).toHaveLength(500);
  });

  it('fails an exhausted retry and sets processedAt', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'failed' }]);
    prisma.outboxEvent.findMany.mockResolvedValue([
      event({ id: 'failed', attempts: 2 }),
    ]);
    queue.add.mockRejectedValue(new Error('queue down'));
    await service.dispatchBatch();
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'failed', status: OutboxStatus.PROCESSING },
      data: expect.objectContaining({
        status: OutboxStatus.FAILED,
        attempts: 3,
        processedAt: expect.any(Date),
        processingStartedAt: null,
      }),
    });
  });

  it('fails unsupported aggregates immediately without enqueueing', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'unknown' }]);
    prisma.outboxEvent.findMany.mockResolvedValue([
      event({ id: 'unknown', aggregateType: 'unknown' }),
    ]);
    await service.dispatchBatch();
    expect(queue.add).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'unknown', status: OutboxStatus.PROCESSING },
      data: expect.objectContaining({
        status: OutboxStatus.FAILED,
        attempts: 1,
        processedAt: expect.any(Date),
        lastError: 'Unsupported outbox aggregate type: unknown',
      }),
    });
  });
});

function createService(prisma: object, queue: object): OutboxDispatcherService {
  const config = new ConfigService({
    queue: {
      enabled: true,
      defaultAttempts: 3,
      defaultBackoffMs: 5000,
      outboxBatchSize: 50,
      outboxProcessingTimeoutMs: 60_000,
    },
  });
  return new OutboxDispatcherService(
    prisma as never,
    config,
    queue as never,
    queue as never,
    queue as never,
    queue as never,
  );
}

function event(
  overrides: Partial<ReturnType<typeof baseEvent>> = {},
): ReturnType<typeof baseEvent> {
  return { ...baseEvent(), ...overrides };
}

function baseEvent() {
  return {
    id: 'event',
    aggregateType: 'mail',
    aggregateId: 'aggregate',
    eventType: 'mail.send.v1',
    payload: {},
    status: OutboxStatus.PROCESSING,
    attempts: 0,
    availableAt: new Date('2026-01-01T00:00:00Z'),
    processedAt: null,
    processingStartedAt: new Date('2026-01-01T00:00:00Z'),
    lastError: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
}

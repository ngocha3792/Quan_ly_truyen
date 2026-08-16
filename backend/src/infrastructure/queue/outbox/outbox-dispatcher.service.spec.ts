/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { readFileSync } from 'node:fs';

import { ConfigService } from '@nestjs/config';

import { OutboxStatus } from '@/generated/prisma/enums';
import {
  AUTHOR_CHAPTER_PUBLISHED_NOTIFICATION_EVENT,
  SEND_MAIL_JOB,
} from '@/infrastructure/queue/contracts';
import { OutboxDispatcherService } from './outbox-dispatcher.service';

const TOKEN_A = '11111111-1111-4111-8111-111111111111';
const TOKEN_B = '22222222-2222-4222-8222-222222222222';
const STALE_RECOVERY_ERROR = 'Recovered stale PROCESSING outbox event';

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
        updateMany: jest
          .fn()
          .mockImplementation((args: { data?: { lastError?: string } }) =>
            Promise.resolve({
              count: args.data?.lastError === STALE_RECOVERY_ERROR ? 0 : 1,
            }),
          ),
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

  it('routes mail outbox events to the mail queue', async () => {
    prisma.$queryRaw.mockResolvedValue([claimed('mail-event-1', TOKEN_A)]);

    prisma.outboxEvent.findMany.mockResolvedValue([
      event({
        id: 'mail-event-1',
        aggregateType: 'mail',
        aggregateId: 'user-1',
        eventType: SEND_MAIL_JOB,
        payload: {
          version: 1,
          templateId: 'email-verification',
          recipientEmail: 'reader@example.test',
          variables: {
            displayName: 'Reader',
          },
        },
      }),
    ]);

    await expect(service.dispatchBatch()).resolves.toBe(1);

    expect(queue.add).toHaveBeenCalledTimes(1);

    expect(queue.add).toHaveBeenCalledWith(
      SEND_MAIL_JOB,

      expect.objectContaining({
        aggregateType: 'mail',
        aggregateId: 'user-1',
        eventType: SEND_MAIL_JOB,
        outboxEventId: 'mail-event-1',

        payload: expect.objectContaining({
          version: 1,
          recipientEmail: 'reader@example.test',
        }),
      }),

      {
        jobId: 'outbox-mail-event-1',

        removeOnComplete: {
          age: 3600,
          count: 100,
        },

        removeOnFail: {
          age: 604_800,
          count: 1000,
        },
      },
    );
  });

  it('routes notification aggregate events to the notifications queue', async () => {
    const notifications = {
      add: jest.fn().mockResolvedValue({ id: 'notification-job' }),
    };
    const routedService = createService(prisma, queue, notifications);
    prisma.$queryRaw.mockResolvedValue([
      claimed('notification-event-1', TOKEN_A),
    ]);
    prisma.outboxEvent.findMany.mockResolvedValue([
      event({
        id: 'notification-event-1',
        aggregateType: 'notifications',
        aggregateId: 'chapter-1',
        eventType: AUTHOR_CHAPTER_PUBLISHED_NOTIFICATION_EVENT,
        payload: { version: 1 },
      }),
    ]);

    await expect(routedService.dispatchBatch()).resolves.toBe(1);

    expect(queue.add).not.toHaveBeenCalled();
    expect(notifications.add).toHaveBeenCalledWith(
      AUTHOR_CHAPTER_PUBLISHED_NOTIFICATION_EVENT,
      expect.objectContaining({
        aggregateType: 'notifications',
        aggregateId: 'chapter-1',
        outboxEventId: 'notification-event-1',
      }),
      { jobId: 'outbox-notification-event-1' },
    );
  });

  it('uses short retention only for mail jobs', async () => {
    prisma.$queryRaw.mockResolvedValue([
      claimed('mail-retention-event', TOKEN_A),
    ]);

    prisma.outboxEvent.findMany.mockResolvedValue([
      event({
        id: 'mail-retention-event',

        aggregateType: 'mail',

        eventType: 'mail.send.v1',
      }),
    ]);

    await service.dispatchBatch();

    expect(queue.add).toHaveBeenCalledWith(
      SEND_MAIL_JOB,

      expect.objectContaining({
        outboxEventId: 'mail-retention-event',
      }),

      {
        jobId: 'outbox-mail-retention-event',

        removeOnComplete: {
          age: 3600,
          count: 100,
        },

        removeOnFail: {
          age: 604_800,
          count: 1000,
        },
      },
    );
  });

  it('keeps the atomic SKIP LOCKED claim and assigns a non-null token', async () => {
    prisma.$queryRaw.mockResolvedValue([claimed('event-1', TOKEN_A)]);
    prisma.outboxEvent.findMany.mockResolvedValue([event({ id: 'event-1' })]);

    await expect(service.dispatchBatch()).resolves.toBe(1);

    const sql = prisma.$queryRaw.mock.calls[0]?.[0] as {
      strings?: readonly string[];
      values?: unknown[];
    };
    expect(sql.strings?.join('')).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql.strings?.join('')).toContain('processing_token');
    expect(sql.values).toContainEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(prisma.outboxEvent.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ processingToken: TOKEN_A }),
      }),
    );
  });

  it('uses a distinct processing token for each claimed batch', async () => {
    await service.dispatchBatch();
    await service.dispatchBatch();

    const tokens = prisma.$queryRaw.mock.calls.map((call: unknown[]) => {
      const sql = call[0] as { values: unknown[] };
      return sql.values.find(
        (value) => typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value),
      );
    });
    expect(tokens[0]).toEqual(expect.any(String));
    expect(tokens[1]).toEqual(expect.any(String));
    expect(tokens[0]).not.toBe(tokens[1]);
  });

  it('publishes only IDs returned by the atomic claim', async () => {
    prisma.$queryRaw.mockResolvedValue([claimed('claimed', TOKEN_A)]);
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
      expect.objectContaining({ jobId: 'outbox-claimed' }),
    );
  });

  it('keeps competing claim batches disjoint', async () => {
    const allEvents = [event({ id: 'a' }), event({ id: 'b' })];
    prisma.$queryRaw
      .mockResolvedValueOnce([claimed('a', TOKEN_A)])
      .mockResolvedValueOnce([claimed('b', TOKEN_B)]);
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

  it('recovers stale processing events and clears ownership without incrementing attempts', async () => {
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
          processingToken: null,
          lastError: STALE_RECOVERY_ERROR,
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

  it('publishes only when the current token wins the finalization CAS', async () => {
    prisma.$queryRaw.mockResolvedValue([claimed('published', TOKEN_A)]);
    prisma.outboxEvent.findMany.mockResolvedValue([event({ id: 'published' })]);

    await expect(service.dispatchBatch()).resolves.toBe(1);

    expect(prisma.outboxEvent.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'published',
        status: OutboxStatus.PROCESSING,
        processingToken: TOKEN_A,
      },
      data: expect.objectContaining({
        status: OutboxStatus.PUBLISHED,
        processingStartedAt: null,
        processingToken: null,
        lastError: null,
      }),
    });
  });

  it('does not count a published job when an old token loses ownership', async () => {
    prisma.$queryRaw.mockResolvedValue([claimed('published', TOKEN_A)]);
    prisma.outboxEvent.findMany.mockResolvedValue([event({ id: 'published' })]);
    prisma.outboxEvent.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(service.dispatchBatch()).resolves.toBe(0);
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(prisma.outboxEvent.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ processingToken: TOKEN_A }),
      }),
    );
  });

  it('does not return a newer claim to pending with an old token', async () => {
    prisma.$queryRaw.mockResolvedValue([claimed('retry', TOKEN_A)]);
    prisma.outboxEvent.findMany.mockResolvedValue([event({ id: 'retry' })]);
    queue.add.mockRejectedValue(new Error('queue down'));
    prisma.outboxEvent.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(service.dispatchBatch()).resolves.toBe(0);
    expect(prisma.outboxEvent.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: 'retry',
          status: OutboxStatus.PROCESSING,
          processingToken: TOKEN_A,
        },
        data: expect.objectContaining({ status: OutboxStatus.PENDING }),
      }),
    );
  });

  it('does not fail a newer claim with an old token', async () => {
    prisma.$queryRaw.mockResolvedValue([claimed('failed', TOKEN_A)]);
    prisma.outboxEvent.findMany.mockResolvedValue([
      event({ id: 'failed', attempts: 2 }),
    ]);
    queue.add.mockRejectedValue(new Error('queue down'));
    prisma.outboxEvent.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(service.dispatchBatch()).resolves.toBe(0);
    expect(prisma.outboxEvent.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: 'failed',
          status: OutboxStatus.PROCESSING,
          processingToken: TOKEN_A,
        },
        data: expect.objectContaining({ status: OutboxStatus.FAILED }),
      }),
    );
  });

  it.each(['media', 'analytics'])(
    'rejects %s because no processor consumes that queue',
    async (aggregateType) => {
      prisma.$queryRaw.mockResolvedValue([claimed('unsupported', TOKEN_A)]);
      prisma.outboxEvent.findMany.mockResolvedValue([
        event({ id: 'unsupported', aggregateType }),
      ]);

      await expect(service.dispatchBatch()).resolves.toBe(0);
      expect(queue.add).not.toHaveBeenCalled();
      expect(prisma.outboxEvent.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ processingToken: TOKEN_A }),
          data: expect.objectContaining({
            status: OutboxStatus.FAILED,
            lastError: `Unsupported outbox aggregate type: ${aggregateType}`,
          }),
        }),
      );
    },
  );

  it('migration adds the token and resets legacy PROCESSING claims', () => {
    const sql = readFileSync(
      'prisma/migrations/20260802002000_finalize_infrastructure_hardening/migration.sql',
      'utf8',
    );
    expect(sql).toContain('ADD COLUMN "processing_token" UUID');
    expect(sql).toContain('WHERE "status" = \'processing\'');
    expect(sql).toContain('"status" = \'pending\'');
    expect(sql).toContain('"processing_token" = NULL');
  });
});

function createService(
  prisma: object,
  queue: object,
  notificationQueue: object = queue,
): OutboxDispatcherService {
  const config = new ConfigService({
    queue: {
      enabled: true,

      defaultAttempts: 3,

      defaultBackoffMs: 5000,

      outboxBatchSize: 50,

      outboxProcessingTimeoutMs: 60_000,

      mailJobRetention: {
        completedAgeSeconds: 3600,

        completedCount: 100,

        failedAgeSeconds: 604_800,

        failedCount: 1000,
      },
    },
  });
  const metrics = {
    recordOutbox: jest.fn(),
    recordOutboxStaleRecovered: jest.fn(),
  };
  const tracing = {
    inSpan: jest.fn(
      (_name: string, _attributes: object, work: () => Promise<unknown>) =>
        work(),
    ),
  };
  const propagation = {
    parse: jest.fn((metadata: unknown) => metadata),
    runWithExtractedContext: jest.fn(
      (_metadata: unknown, work: () => Promise<unknown>) => work(),
    ),
  };
  return new OutboxDispatcherService(
    prisma as never,
    config,
    queue as never,
    notificationQueue as never,
    metrics as never,
    tracing as never,
    propagation as never,
  );
}

function claimed(id: string, processingToken: string) {
  return { id, processingToken };
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
    metadata: {
      schemaVersion: 1,
      source: 'api',
      correlationId: 'correlation-1',
      traceContext: {
        traceparent: '00-11111111111111111111111111111111-2222222222222222-01',
      },
    },
    status: OutboxStatus.PROCESSING,
    attempts: 0,
    availableAt: new Date('2026-01-01T00:00:00Z'),
    processedAt: null,
    processingStartedAt: new Date('2026-01-01T00:00:00Z'),
    processingToken: TOKEN_A,
    lastError: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
}

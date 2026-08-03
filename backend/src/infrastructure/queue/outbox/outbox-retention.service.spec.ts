/* eslint-disable
  @typescript-eslint/no-unsafe-member-access,
  @typescript-eslint/no-unsafe-assignment
*/

import { OutboxStatus } from '@/generated/prisma/enums';

import { OutboxRetentionService } from './outbox-retention.service';

describe('OutboxRetentionService', () => {
  let prisma: {
    $queryRaw: jest.Mock;

    $transaction: jest.Mock;

    outboxEvent: {
      deleteMany: jest.Mock;

      updateMany: jest.Mock;
    };
  };

  let service: OutboxRetentionService;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),

      $transaction: jest.fn(),

      outboxEvent: {
        deleteMany: jest.fn(),

        updateMany: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma),
    );

    service = new OutboxRetentionService(prisma as never);
  });

  it('does not mutate records in dry-run mode', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'published-old',
        },
      ])

      .mockResolvedValueOnce([
        {
          id: 'failed-old',
        },
      ])

      .mockResolvedValueOnce([
        {
          id: 'published-redact',
        },
      ]);

    const summary = await service.cleanup({
      apply: false,

      batchSize: 50,

      redactAfterHours: 24,

      publishedRetentionDays: 30,

      failedRetentionDays: 90,

      now: new Date('2026-08-03T00:00:00Z'),
    });

    expect(summary.mode).toBe('dry-run');

    expect(summary.planned).toEqual({
      publishedDeleted: 1,

      failedDeleted: 1,

      publishedRedacted: 1,
    });

    expect(summary.applied).toEqual({
      publishedDeleted: 0,

      failedDeleted: 0,

      publishedRedacted: 0,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();

    expect(prisma.outboxEvent.deleteMany).not.toHaveBeenCalled();

    expect(prisma.outboxEvent.updateMany).not.toHaveBeenCalled();
  });

  it('deletes and redacts only selected candidates when apply is enabled', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'published-old',
        },
      ])

      .mockResolvedValueOnce([
        {
          id: 'failed-old',
        },
      ])

      .mockResolvedValueOnce([
        {
          id: 'published-redact',
        },
      ]);

    prisma.outboxEvent.deleteMany
      .mockResolvedValueOnce({
        count: 1,
      })

      .mockResolvedValueOnce({
        count: 1,
      });

    prisma.outboxEvent.updateMany.mockResolvedValue({
      count: 1,
    });

    const summary = await service.cleanup({
      apply: true,

      batchSize: 50,

      redactAfterHours: 24,

      publishedRetentionDays: 30,

      failedRetentionDays: 90,

      now: new Date('2026-08-03T00:00:00Z'),
    });

    expect(summary.applied).toEqual({
      publishedDeleted: 1,

      failedDeleted: 1,

      publishedRedacted: 1,
    });

    expect(prisma.outboxEvent.deleteMany).toHaveBeenNthCalledWith(
      1,

      expect.objectContaining({
        where: expect.objectContaining({
          id: {
            in: ['published-old'],
          },

          status: OutboxStatus.PUBLISHED,

          aggregateType: 'mail',

          eventType: 'mail.send.v1',
        }),
      }),
    );

    expect(prisma.outboxEvent.deleteMany).toHaveBeenNthCalledWith(
      2,

      expect.objectContaining({
        where: expect.objectContaining({
          id: {
            in: ['failed-old'],
          },

          status: OutboxStatus.FAILED,

          aggregateType: 'mail',

          eventType: 'mail.send.v1',
        }),
      }),
    );

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: {
            in: ['published-redact'],
          },

          status: OutboxStatus.PUBLISHED,
        }),

        data: {
          payload: {
            version: 1,

            redacted: true,

            reason: 'mail-outbox-retention',

            redactedAt: '2026-08-03T00:00:00.000Z',
          },
        },
      }),
    );

    const serializedUpdate = JSON.stringify(
      prisma.outboxEvent.updateMany.mock.calls,
    );

    expect(serializedUpdate).not.toContain('ciphertext');

    expect(serializedUpdate).not.toContain('token=');
  });

  it('respects the configured batch size', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await service.cleanup({
      apply: false,

      batchSize: 25,

      redactAfterHours: 24,

      publishedRetentionDays: 30,

      failedRetentionDays: 90,

      now: new Date('2026-08-03T00:00:00Z'),
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);

    for (const call of prisma.$queryRaw.mock.calls) {
      const query = call[0] as {
        strings: readonly string[];

        values: readonly unknown[];
      };

      expect(query.strings.join('')).toContain('LIMIT');

      expect(query.values).toContain(25);
    }
  });

  it('does not allow delete retention shorter than redaction retention', async () => {
    await expect(
      service.cleanup({
        apply: false,

        batchSize: 50,

        redactAfterHours: 48,

        publishedRetentionDays: 1,

        failedRetentionDays: 90,

        now: new Date('2026-08-03T00:00:00Z'),
      }),
    ).rejects.toThrow(
      'publishedRetentionDays must be longer than redactAfterHours',
    );
  });

  it('rejects oversized batches', async () => {
    await expect(
      service.cleanup({
        apply: false,

        batchSize: 501,

        redactAfterHours: 24,

        publishedRetentionDays: 30,

        failedRetentionDays: 90,
      }),
    ).rejects.toThrow('batchSize cannot exceed 500');
  });
});

/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers are typed as any. */
import { ConfigService } from '@nestjs/config';

import {
  WeeklyReadingRecapScheduler,
  previousClosedWeek,
} from './weekly-reading-recap.scheduler';

const NOW = new Date('2026-09-07T02:00:00.000Z');
const ENABLED_AT = '2026-08-31T03:00:00.000Z';

describe('WeeklyReadingRecapScheduler', () => {
  it('uses the previous closed Monday-Sunday week in the analytics timezone', () => {
    expect(previousClosedWeek(NOW, 'Asia/Ho_Chi_Minh')).toEqual({
      startDate: '2026-08-31',
      endDate: '2026-09-06',
    });
  });

  it('creates one in-app notification and one encrypted-mail outbox input', async () => {
    const subscriber = createSubscriber();
    const tx = transactionClient(subscriber);
    const prisma = prismaClient(subscriber, tx);
    const outboxWriter = {
      create: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
    };
    const scheduler = createScheduler(prisma, outboxWriter);

    await scheduler.tick(NOW);

    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dedupeKey: `weekly-reading-recap:2026-08-31:${subscriber.userId}`,
        userId: subscriber.userId,
        type: 'weekly_reading_recap',
        body: 'Tuần qua bạn đã đọc 1 giờ 30 phút trong 4 ngày và hoàn thành 3 chương.',
        data: expect.objectContaining({
          readingMinutes: 90,
          chaptersCompleted: 3,
          activeDays: 4,
        }),
      }),
    });
    expect(outboxWriter.create).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        aggregateType: 'mail',
        idempotencyKey: `weekly-reading-recap:email:2026-08-31:${subscriber.userId}`,
        payload: expect.objectContaining({
          recipientEmail: 'reader@example.com',
          variables: expect.objectContaining({
            recapUrl: 'https://103.74.100.55.nip.io/tai-khoan/lich-su',
          }),
        }),
      }),
    );
  });

  it('does not send a closed-week recap when the user opted in after it ended', async () => {
    const subscriber = createSubscriber({
      weeklyRecapInAppEnabledAt: '2026-09-07T01:00:00.000Z',
      weeklyRecapEmailEnabledAt: '2026-09-07T01:00:00.000Z',
    });
    const tx = transactionClient(subscriber);
    const prisma = prismaClient(subscriber, tx);
    const outboxWriter = { create: jest.fn() };

    await createScheduler(prisma, outboxWriter).tick(NOW);

    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(outboxWriter.create).not.toHaveBeenCalled();
  });

  it('treats existing channel records as delivered on retries', async () => {
    const subscriber = createSubscriber();
    const tx = transactionClient(subscriber);
    tx.notification.findUnique.mockResolvedValue({ id: 'notification-1' });
    tx.outboxEvent.findUnique.mockResolvedValue({ id: 'outbox-1' });
    const prisma = prismaClient(subscriber, tx);
    const outboxWriter = { create: jest.fn() };

    await createScheduler(prisma, outboxWriter).tick(NOW);

    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(outboxWriter.create).not.toHaveBeenCalled();
  });

  it('does not rescan the same closed week every hour in one worker', async () => {
    const subscriber = createSubscriber();
    const tx = transactionClient(subscriber);
    const prisma = prismaClient(subscriber, tx);
    const scheduler = createScheduler(prisma, { create: jest.fn() });

    await scheduler.tick(NOW);
    await scheduler.tick(new Date('2026-09-07T03:00:00.000Z'));

    expect(prisma.notificationPreference.findMany).toHaveBeenCalledTimes(1);
  });
});

function createScheduler(prisma: unknown, outboxWriter: unknown) {
  const config = {
    getOrThrow: jest.fn((key: string) =>
      key === 'analytics'
        ? { enabled: true, timeZone: 'Asia/Ho_Chi_Minh' }
        : {
            enabled: true,
            frontendPublicUrl: 'https://103.74.100.55.nip.io/',
          },
    ),
  } as unknown as ConfigService;
  return new WeeklyReadingRecapScheduler(
    config,
    prisma as never,
    outboxWriter as never,
  );
}

function createSubscriber(preferenceOverrides: Record<string, unknown> = {}) {
  return {
    userId: '00000000-0000-4000-8000-000000000001',
    emailEnabled: true,
    inAppEnabled: true,
    preferences: {
      weeklyRecapInApp: true,
      weeklyRecapEmail: true,
      weeklyRecapInAppEnabledAt: ENABLED_AT,
      weeklyRecapEmailEnabledAt: ENABLED_AT,
      ...preferenceOverrides,
    },
    user: {
      email: 'reader@example.com',
      displayName: 'Bạn đọc',
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  };
}

function prismaClient(
  subscriber: ReturnType<typeof createSubscriber>,
  tx: ReturnType<typeof transactionClient>,
) {
  return {
    notificationPreference: {
      findMany: jest.fn().mockResolvedValue([subscriber]),
    },
    $queryRaw: jest.fn().mockResolvedValue([
      {
        userId: subscriber.userId,
        readingSeconds: BigInt(5_400),
        chaptersCompleted: 3,
        activeDays: 4,
      },
    ]),
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  };
}

function transactionClient(subscriber: ReturnType<typeof createSubscriber>) {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
    notificationPreference: {
      findFirst: jest.fn().mockResolvedValue(subscriber),
    },
    notification: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
    },
    outboxEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
}

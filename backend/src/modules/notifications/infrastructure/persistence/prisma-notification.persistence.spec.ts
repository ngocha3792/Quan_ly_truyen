/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Jest mock calls and asymmetric matchers are typed as any. */
import { PrismaNotificationPersistence } from './prisma-notification.persistence';

describe('PrismaNotificationPersistence weekly recap preferences', () => {
  it('records the opt-in time while preserving unrelated JSON preferences', async () => {
    const tx = transactionClient({
      theme: 'dark',
      weeklyRecapInApp: false,
    });
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const persistence = new PrismaNotificationPersistence(prisma as never);

    await persistence.upsertPreference({
      userId: 'user-1',
      weeklyRecapInApp: true,
      weeklyRecapEmail: true,
    });

    const call = tx.notificationPreference.upsert.mock.calls[0]?.[0];
    expect(call.update.preferences).toEqual(
      expect.objectContaining({
        theme: 'dark',
        weeklyRecapInApp: true,
        weeklyRecapEmail: true,
        weeklyRecapInAppEnabledAt: expect.any(String),
        weeklyRecapEmailEnabledAt: expect.any(String),
      }),
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('does not move the original opt-in time on an unrelated update', async () => {
    const originalEnabledAt = '2026-08-31T01:00:00.000Z';
    const tx = transactionClient({
      weeklyRecapInApp: true,
      weeklyRecapInAppEnabledAt: originalEnabledAt,
    });
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const persistence = new PrismaNotificationPersistence(prisma as never);

    await persistence.upsertPreference({
      userId: 'user-1',
      promotions: false,
    });

    expect(
      tx.notificationPreference.upsert.mock.calls[0]?.[0].update.preferences,
    ).toEqual(
      expect.objectContaining({
        weeklyRecapInApp: true,
        weeklyRecapInAppEnabledAt: originalEnabledAt,
      }),
    );
  });
});

function transactionClient(preferences: Record<string, unknown>) {
  const record = {
    userId: 'user-1',
    newChapterEnabled: true,
    commentReplyEnabled: true,
    moderationEnabled: true,
    preferences,
  };
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
    notificationPreference: {
      findUnique: jest.fn().mockResolvedValue(record),
      upsert: jest.fn().mockResolvedValue(record),
    },
  };
}

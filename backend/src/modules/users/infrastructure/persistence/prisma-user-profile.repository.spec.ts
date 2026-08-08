/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers are typed as any. */
import { PrismaUserProfileRepository } from './prisma-user-profile.repository';

describe('PrismaUserProfileRepository', () => {
  const userId = '11111111-1111-4111-8111-111111111111';

  const changedAt = new Date('2026-08-08T01:00:00.000Z');

  it('uses the command timestamp for profile and audit writes', async () => {
    const profile = {
      id: userId,
      email: 'reader@example.com',
      username: 'reader',
      displayName: 'Reader',
      bio: null,
      status: 'ACTIVE',
      emailVerifiedAt: null,
      lastLoginAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: changedAt,
      avatarMedia: null,
    };

    const transaction = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          displayName: 'Old name',
          bio: null,
          avatarMediaId: null,
        }),
        update: jest.fn().mockResolvedValue(profile),
      },
      mediaAsset: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const prisma = {
      $transaction: jest.fn(
        async (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    };

    const repository = new PrismaUserProfileRepository(prisma as never);

    await repository.updateProfile({
      userId,
      displayName: 'Reader',
      changedAt,
      audit: {
        requestId: 'request-1',
      },
    });

    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          updatedAt: changedAt,
        }),
      }),
    );

    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdAt: changedAt,
        }),
      }),
    );
  });

  it('locks preferences and only updates supplied fields', async () => {
    const oldUpdatedAt = new Date('2026-08-07T01:00:00.000Z');

    const calls: string[] = [];

    const transaction = {
      $executeRaw: jest.fn().mockImplementation(() => {
        calls.push('ensure-row');

        return Promise.resolve(0);
      }),

      $queryRaw: jest.fn().mockImplementation(() => {
        calls.push('lock-row');

        return Promise.resolve([
          {
            emailEnabled: true,

            newChapterEnabled: true,

            preferences: {
              showRecentActivity: true,
            },

            updatedAt: oldUpdatedAt,
          },
        ]);
      }),

      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: userId,
        }),
      },

      notificationPreference: {
        update: jest.fn().mockImplementation(() => {
          calls.push('update');

          return Promise.resolve({
            emailEnabled: false,

            newChapterEnabled: true,

            preferences: {
              showRecentActivity: true,
            },

            updatedAt: changedAt,
          });
        }),
      },

      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const prisma = {
      $transaction: jest.fn(
        async (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    };

    const repository = new PrismaUserProfileRepository(prisma as never);

    await repository.updatePreferences({
      userId,

      /*
       * Chỉ thay allowUpdateEmails.
       *
       * Hai field còn lại không được ghi đè.
       */
      allowUpdateEmails: false,

      changedAt,

      audit: {},
    });

    expect(calls).toEqual(['ensure-row', 'lock-row', 'update']);

    expect(transaction.notificationPreference.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId,
        },

        data: {
          updatedAt: changedAt,

          emailEnabled: false,
        },
      }),
    );

    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdAt: changedAt,

          oldValues: {
            newChapterNotifications: true,

            showRecentActivity: true,

            allowUpdateEmails: true,
          },

          newValues: {
            newChapterNotifications: true,

            showRecentActivity: true,

            allowUpdateEmails: false,
          },
        }),
      }),
    );
  });

  it('locks avatar media row trước khi validate và attach', async () => {
    const avatarMediaId = '22222222-2222-4222-8222-222222222222';

    const profile = {
      id: userId,

      email: 'reader@example.com',

      username: 'reader',

      displayName: 'Reader',

      bio: null,

      status: 'ACTIVE',

      emailVerifiedAt: null,

      lastLoginAt: null,

      createdAt: new Date('2026-01-01T00:00:00.000Z'),

      updatedAt: changedAt,

      avatarMedia: {
        id: avatarMediaId,

        secureUrl: 'https://example.test/avatar.jpg',

        publicUrl: null,
      },
    };

    const calls: string[] = [];

    const transaction = {
      $queryRaw: jest.fn().mockImplementation(() => {
        calls.push('lock-media');

        return Promise.resolve([
          {
            id: avatarMediaId,
          },
        ]);
      }),

      user: {
        findFirst: jest.fn().mockResolvedValue({
          displayName: 'Old name',

          bio: null,

          avatarMediaId: null,
        }),

        update: jest.fn().mockImplementation(() => {
          calls.push('update-user');

          return Promise.resolve(profile);
        }),
      },

      mediaAsset: {
        findFirst: jest.fn().mockImplementation(() => {
          calls.push('validate-media');

          return Promise.resolve({
            id: avatarMediaId,
          });
        }),
      },

      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const prisma = {
      $transaction: jest.fn(
        async (operation: (client: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    };

    const repository = new PrismaUserProfileRepository(prisma as never);

    await repository.updateProfile({
      userId,

      avatarMediaId,

      changedAt,

      audit: {
        requestId: 'request-avatar-lock',
      },
    });

    expect(calls).toEqual(['lock-media', 'validate-media', 'update-user']);
  });
});

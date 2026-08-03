import { SEND_MAIL_JOB } from '@/infrastructure/queue/contracts';

import { PrismaPasswordResetPersistence } from './prisma-password-reset.persistence';
import { PrismaRegistrationUnitOfWork } from './prisma-registration-unit-of-work';
import { PrismaResendEmailVerificationPersistence } from './prisma-resend-email-verification.persistence';

describe('Auth mail outbox routing', () => {
  it('registration creates a mail outbox event', async () => {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),

        create: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'reader@example.test',
          username: 'reader',
          displayName: 'Reader',
        }),
      },

      role: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'role-user',
        }),
      },

      userRole: {
        create: jest.fn().mockResolvedValue({
          id: 'user-role-1',
        }),
      },

      userToken: {
        create: jest.fn().mockResolvedValue({
          id: 'verification-token-1',
        }),
      },
    };

    const prisma = transactionPrisma(tx);
    const outboxWriter = outboxWriterMock();

    const urlBuilder = {
      build: jest
        .fn()
        .mockReturnValue(
          'https://app.example.test/verify-email?token=raw-token',
        ),
    };

    const service = new PrismaRegistrationUnitOfWork(
      prisma as never,
      outboxWriter as never,
      urlBuilder as never,
    );

    await expect(
      service.execute({
        email: 'reader@example.test',
        username: 'reader',
        passwordHash: 'password-hash',
        displayName: 'Reader',

        rawVerificationToken: 'raw-verification-token',
        verificationTokenHash: 'verification-token-hash',

        verificationExpiresAt: new Date('2026-08-02T13:00:00Z'),
        verificationExpiresInMinutes: 30,
      }),
    ).resolves.toEqual({
      id: 'user-1',
      email: 'reader@example.test',
      username: 'reader',
      displayName: 'Reader',
    });

    expect(outboxWriter.create).toHaveBeenCalledTimes(1);

    expect(outboxWriter.create).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        aggregateType: 'mail',
        aggregateId: 'user-1',
        eventType: SEND_MAIL_JOB,
        idempotencyKey: 'email-verification:verification-token-1',
      }),
    );
  });

  it('resend verification creates a mail outbox event', async () => {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-2',
          email: 'author@example.test',
          displayName: 'Author',
          emailVerifiedAt: null,
        }),
      },

      userToken: {
        updateMany: jest.fn().mockResolvedValue({
          count: 1,
        }),

        create: jest.fn().mockResolvedValue({
          id: 'verification-token-2',
        }),
      },
    };

    const prisma = transactionPrisma(tx);
    const outboxWriter = outboxWriterMock();

    const urlBuilder = {
      build: jest
        .fn()
        .mockReturnValue(
          'https://app.example.test/verify-email?token=raw-token',
        ),
    };

    const service = new PrismaResendEmailVerificationPersistence(
      prisma as never,
      outboxWriter as never,
      urlBuilder as never,
    );

    await expect(
      service.execute({
        email: 'author@example.test',

        rawToken: 'raw-verification-token',
        tokenHash: 'verification-token-hash',

        expiresAt: new Date('2026-08-02T13:00:00Z'),
        expiresInMinutes: 30,
      }),
    ).resolves.toBe('queued');

    expect(outboxWriter.create).toHaveBeenCalledTimes(1);

    expect(outboxWriter.create).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        aggregateType: 'mail',
        aggregateId: 'user-2',
        eventType: SEND_MAIL_JOB,
        idempotencyKey: 'email-verification-resend:verification-token-2',
      }),
    );
  });

  it('forgot password creates a mail outbox event', async () => {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-3',
          email: 'admin@example.test',
          displayName: 'Admin',
        }),
      },

      userToken: {
        updateMany: jest.fn().mockResolvedValue({
          count: 1,
        }),

        create: jest.fn().mockResolvedValue({
          id: 'password-reset-token-1',
        }),
      },
    };

    const prisma = transactionPrisma(tx);
    const outboxWriter = outboxWriterMock();

    const resetUrlBuilder = {
      build: jest
        .fn()
        .mockReturnValue(
          'https://app.example.test/reset-password?token=raw-token',
        ),
    };

    const service = new PrismaPasswordResetPersistence(
      prisma as never,
      outboxWriter as never,
      resetUrlBuilder as never,
    );

    await expect(
      service.request({
        email: 'admin@example.test',

        rawToken: 'raw-password-reset-token',
        tokenHash: 'password-reset-token-hash',

        expiresAt: new Date('2026-08-02T13:00:00Z'),
        expiresInMinutes: 30,
      }),
    ).resolves.toBe('queued');

    expect(outboxWriter.create).toHaveBeenCalledTimes(1);

    expect(outboxWriter.create).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        aggregateType: 'mail',
        aggregateId: 'user-3',
        eventType: SEND_MAIL_JOB,
        idempotencyKey: 'password-reset:password-reset-token-1',
      }),
    );
  });
});

function transactionPrisma<TTransaction extends object>(
  transaction: TTransaction,
) {
  return {
    $transaction: jest.fn((callback: (tx: TTransaction) => Promise<unknown>) =>
      callback(transaction),
    ),
  };
}

function outboxWriterMock() {
  return {
    create: jest.fn().mockResolvedValue({
      id: 'outbox-event-1',
    }),
  };
}

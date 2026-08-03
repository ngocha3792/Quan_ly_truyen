import { randomUUID } from 'node:crypto';

import type { TestingModule } from '@nestjs/testing';

import { Test } from '@nestjs/testing';

import { RoleCode } from '@/common/enums';

import { sha256 } from '@/common/utils';

import { AppConfigModule } from '@/config';

import { OutboxStatus, TokenType } from '@/generated/prisma/client';

import { PrismaModule, PrismaService } from '@/infrastructure/database';

import { MailPayloadSecurityModule } from '@/infrastructure/mail/security';

import {
  isEncryptedMailPayloadV1,
  SEND_MAIL_JOB,
} from '@/infrastructure/queue/contracts';

import { OutboxWriterService } from '@/infrastructure/queue/outbox';

import { RequestContextStore } from '@/common/middlewares';

import { TracePropagationService } from '@/infrastructure/observability';

import {
  RefreshTokenCommand,
  RefreshTokenCommandHandler,
} from '@/modules/auth/application';

import { SessionRevocationReason } from '@/modules/auth/domain/enums';

import {
  EmailVerificationUrlBuilder,
  PasswordResetUrlBuilder,
  ChangeEmailUrlBuilder,
} from '@/modules/auth/infrastructure/mail';

import { AuthAuditWriterService } from '@/modules/auth/infrastructure/audit';

import {
  PrismaEmailVerificationPersistence,
  PrismaPasswordResetPersistence,
  PrismaRefreshSessionPersistence,
  PrismaRegistrationUnitOfWork,
  PrismaChangePasswordPersistence,
  PrismaEmailChangePersistence,
  PrismaLoginPersistence,
} from '@/modules/auth/infrastructure/persistence/prisma/repositories';

describe('Auth PostgreSQL persistence', () => {
  let moduleRef: TestingModule;

  let prisma: PrismaService;

  let registration: PrismaRegistrationUnitOfWork;

  let verification: PrismaEmailVerificationPersistence;

  let passwordReset: PrismaPasswordResetPersistence;

  let refreshPersistence: PrismaRefreshSessionPersistence;

  let changePasswordPersistence: PrismaChangePasswordPersistence;
  let emailChangePersistence: PrismaEmailChangePersistence;

  const runId = randomUUID();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule, MailPayloadSecurityModule],

      providers: [
        RequestContextStore,

        TracePropagationService,
        AuthAuditWriterService,

        PrismaLoginPersistence,

        OutboxWriterService,

        EmailVerificationUrlBuilder,

        PasswordResetUrlBuilder,

        PrismaRegistrationUnitOfWork,

        PrismaEmailVerificationPersistence,

        PrismaPasswordResetPersistence,

        PrismaRefreshSessionPersistence,
        PrismaChangePasswordPersistence,
        PrismaEmailChangePersistence,

        ChangeEmailUrlBuilder,
      ],
    }).compile();

    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);

    registration = moduleRef.get(PrismaRegistrationUnitOfWork);

    verification = moduleRef.get(PrismaEmailVerificationPersistence);

    passwordReset = moduleRef.get(PrismaPasswordResetPersistence);

    refreshPersistence = moduleRef.get(PrismaRefreshSessionPersistence);

    emailChangePersistence = moduleRef.get(PrismaEmailChangePersistence);
    changePasswordPersistence = moduleRef.get(PrismaChangePasswordPersistence);

    await prisma.role.upsert({
      where: {
        code: RoleCode.USER,
      },

      update: {},

      create: {
        code: RoleCode.USER,

        name: 'User',

        description: 'Integration test default role',

        isSystem: true,
      },
    });
  });

  afterEach(async () => {
    await cleanupRun();
  });

  afterAll(async () => {
    await cleanupRun();

    await moduleRef.close();
  });
  it('revokes the oldest session and writes audit when session limit is exceeded', async () => {
    const user = await prisma.user.create({
      data: {
        email: `session-limit.${runId}@example.test`,

        username: `session_limit_${runId.replaceAll('-', '').slice(0, 12)}`,

        passwordHash: 'password-hash',

        displayName: 'Session Limit User',

        emailVerifiedAt: new Date(),
      },
    });

    const oldest = await prisma.session.create({
      data: {
        userId: user.id,

        refreshTokenHash: `oldest-${runId}`,

        refreshTokenFamilyId: randomUUID(),

        lastUsedAt: new Date('2026-08-01T00:00:00.000Z'),

        expiresAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    /*
     * Test config nên đặt:
     * AUTH_MAX_ACTIVE_SESSIONS=2
     */
    await prisma.session.create({
      data: {
        userId: user.id,

        refreshTokenHash: `newer-${runId}`,

        refreshTokenFamilyId: randomUUID(),

        lastUsedAt: new Date('2026-08-02T00:00:00.000Z'),

        expiresAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    const persistence = moduleRef.get(PrismaLoginPersistence);

    const newSessionId = randomUUID();

    await persistence.createSession({
      id: newSessionId,

      userId: user.id,

      refreshTokenHash: `new-login-${runId}`,

      refreshTokenFamilyId: randomUUID(),

      refreshTokenVersion: 0,

      accessTokenVersion: 0,

      deviceName: 'Integration browser',

      ipAddress: '127.0.0.1',

      userAgent: 'Jest',

      loggedInAt: new Date('2026-08-03T00:00:00.000Z'),

      expiresAt: new Date('2026-09-03T00:00:00.000Z'),
    });

    const freshOldest = await prisma.session.findUniqueOrThrow({
      where: {
        id: oldest.id,
      },
    });

    expect(freshOldest.revokedReason).toBe('session_limit_exceeded');

    const activeCount = await prisma.session.count({
      where: {
        userId: user.id,

        revokedAt: null,

        expiresAt: {
          gt: new Date(),
        },
      },
    });

    expect(activeCount).toBe(2);

    const actions = await prisma.auditLog.findMany({
      where: {
        actorId: user.id,
      },

      orderBy: {
        createdAt: 'asc',
      },

      select: {
        action: true,

        entityId: true,
      },
    });

    expect(actions).toEqual(
      expect.arrayContaining([
        {
          action: 'auth.session.limit_enforced',

          entityId: user.id,
        },

        {
          action: 'auth.login.succeeded',

          entityId: newSessionId,
        },
      ]),
    );
  });

  it('requests and confirms an email change atomically', async () => {
    const user = await prisma.user.create({
      data: {
        email: `email-change-old.${runId}@example.test`,

        username: `email_change_${runId.replaceAll('-', '').slice(0, 12)}`,

        passwordHash: 'password-hash',

        displayName: 'Email Change User',

        emailVerifiedAt: new Date(),
      },
    });

    const firstSession = await prisma.session.create({
      data: {
        userId: user.id,

        refreshTokenHash: `email-change-refresh-1-${runId}`,

        refreshTokenFamilyId: randomUUID(),

        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const secondSession = await prisma.session.create({
      data: {
        userId: user.id,

        refreshTokenHash: `email-change-refresh-2-${runId}`,

        refreshTokenFamilyId: randomUUID(),

        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const resetToken = await prisma.userToken.create({
      data: {
        userId: user.id,

        type: TokenType.PASSWORD_RESET,

        tokenHash: `email-change-reset-${runId}`,

        expiresAt: new Date(Date.now() + 900_000),
      },
    });

    const rawToken = Buffer.from(`${runId}:change-email:${'x'.repeat(64)}`)
      .toString('base64url')
      .slice(0, 64);

    const newEmail = `email-change-new.${runId}@example.test`;

    const expiresAt = new Date(Date.now() + 30 * 60_000);

    const requestResult = await emailChangePersistence.request({
      userId: user.id,

      expectedCurrentEmail: user.email,

      expectedPasswordHash: 'password-hash',

      newEmail,

      rawToken,

      tokenHash: sha256(rawToken),

      requestedAt: new Date(),

      expiresAt,

      expiresInMinutes: 30,
    });

    expect(requestResult).toMatchObject({
      status: 'requested',

      newEmail,
    });

    /*
     * Email thật chưa đổi trước confirmation.
     */
    const beforeConfirm = await prisma.user.findUniqueOrThrow({
      where: {
        id: user.id,
      },
    });

    expect(beforeConfirm.email).toBe(user.email);

    const token = await prisma.userToken.findFirstOrThrow({
      where: {
        userId: user.id,

        type: TokenType.CHANGE_EMAIL,

        consumedAt: null,
      },
    });

    expect(token.payload).toEqual({
      version: 1,

      currentEmail: user.email,

      newEmail,
    });

    const outbox = await prisma.outboxEvent.findFirstOrThrow({
      where: {
        aggregateId: user.id,

        eventType: SEND_MAIL_JOB,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    expect(outbox.aggregateType).toBe('mail');

    expect(isEncryptedMailPayloadV1(outbox.payload)).toBe(true);

    expect(JSON.stringify(outbox.payload)).not.toContain(rawToken);

    const changedAt = new Date();

    const confirmResult = await emailChangePersistence.confirm({
      tokenHash: sha256(rawToken),

      confirmedAt: changedAt,
    });

    expect(confirmResult).toEqual({
      status: 'changed',

      previousEmail: user.email,

      email: newEmail,

      changedAt,

      sessionsRevoked: 2,
    });

    const changedUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: user.id,
      },
    });

    expect(changedUser.email).toBe(newEmail);

    expect(changedUser.emailVerifiedAt).toEqual(changedAt);

    const sessions = await prisma.session.findMany({
      where: {
        id: {
          in: [firstSession.id, secondSession.id],
        },
      },
    });

    expect(sessions.every(({ revokedAt }) => revokedAt !== null)).toBe(true);

    expect(
      sessions.every(({ revokedReason }) => revokedReason === 'email_changed'),
    ).toBe(true);

    const consumedResetToken = await prisma.userToken.findUniqueOrThrow({
      where: {
        id: resetToken.id,
      },
    });

    expect(consumedResetToken.consumedAt).not.toBeNull();

    /*
     * Confirmation lần hai là idempotent.
     */
    const secondConfirm = await emailChangePersistence.confirm({
      tokenHash: sha256(rawToken),

      confirmedAt: new Date(),
    });

    expect(secondConfirm.status).toBe('already_changed');
  });

  it('changes password, preserves current refresh session and revokes every other session', async () => {
    const user = await prisma.user.create({
      data: {
        email: `change-password.${runId}@example.test`,

        username: `change_password_${runId.replaceAll('-', '').slice(0, 12)}`,

        passwordHash: 'old-password-hash',

        displayName: 'Change Password User',

        emailVerifiedAt: new Date(),
      },
    });

    const currentSession = await prisma.session.create({
      data: {
        userId: user.id,

        refreshTokenHash: `current-refresh-${runId}`,

        refreshTokenFamilyId: randomUUID(),

        refreshTokenVersion: 0,

        accessTokenVersion: 0,

        lastUsedAt: new Date(),

        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const otherSession = await prisma.session.create({
      data: {
        userId: user.id,

        refreshTokenHash: `other-refresh-${runId}`,

        refreshTokenFamilyId: randomUUID(),

        refreshTokenVersion: 0,

        accessTokenVersion: 0,

        lastUsedAt: new Date(),

        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const resetToken = await prisma.userToken.create({
      data: {
        userId: user.id,

        type: TokenType.PASSWORD_RESET,

        tokenHash: `reset-hash-${runId}`,

        expiresAt: new Date(Date.now() + 900_000),
      },
    });

    const changedAt = new Date();

    const result = await changePasswordPersistence.changePassword({
      userId: user.id,

      currentSessionId: currentSession.id,

      expectedPasswordHash: 'old-password-hash',

      nextPasswordHash: 'new-password-hash',

      changedAt,
    });

    expect(result).toEqual({
      status: 'changed',

      otherSessionsRevoked: 1,

      changedAt,
    });

    const freshUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: user.id,
      },
    });

    expect(freshUser.passwordHash).toBe('new-password-hash');

    const freshCurrentSession = await prisma.session.findUniqueOrThrow({
      where: {
        id: currentSession.id,
      },
    });

    expect(freshCurrentSession.revokedAt).toBeNull();

    expect(freshCurrentSession.refreshTokenVersion).toBe(0);

    expect(freshCurrentSession.accessTokenVersion).toBe(1);

    const freshOtherSession = await prisma.session.findUniqueOrThrow({
      where: {
        id: otherSession.id,
      },
    });

    expect(freshOtherSession.revokedAt).not.toBeNull();

    expect(freshOtherSession.revokedReason).toBe('password_changed');

    expect(freshOtherSession.refreshTokenVersion).toBe(1);

    expect(freshOtherSession.accessTokenVersion).toBe(1);

    const freshResetToken = await prisma.userToken.findUniqueOrThrow({
      where: {
        id: resetToken.id,
      },
    });

    expect(freshResetToken.consumedAt).not.toBeNull();
  });

  it('creates user, role, verification token and encrypted mail outbox atomically', async () => {
    const rawToken = token('register');

    const result = await registration.execute({
      email: email('register'),

      username: username('register'),

      passwordHash: 'password-hash',

      displayName: 'Integration Reader',

      rawVerificationToken: rawToken,

      verificationTokenHash: sha256(rawToken),

      verificationExpiresAt: futureDate(30),

      verificationExpiresInMinutes: 30,
    });

    const user = await prisma.user.findUnique({
      where: {
        id: result.id,
      },

      include: {
        userRoles: {
          include: {
            role: true,
          },
        },

        tokens: true,
      },
    });

    expect(user).toMatchObject({
      email: email('register'),

      username: username('register'),

      passwordHash: 'password-hash',
    });

    expect(user?.userRoles.map(({ role }) => role.code)).toContain(
      RoleCode.USER,
    );

    expect(user?.tokens).toHaveLength(1);

    expect(user?.tokens[0]).toMatchObject({
      type: TokenType.EMAIL_VERIFICATION,

      tokenHash: sha256(rawToken),

      consumedAt: null,
    });

    const outbox = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: result.id,

        eventType: SEND_MAIL_JOB,
      },
    });

    expect(outbox).toMatchObject({
      aggregateType: 'mail',

      aggregateId: result.id,

      eventType: SEND_MAIL_JOB,

      status: OutboxStatus.PENDING,
    });

    expect(isEncryptedMailPayloadV1(outbox?.payload)).toBe(true);

    expect(JSON.stringify(outbox?.payload)).not.toContain(rawToken);

    expect(JSON.stringify(outbox?.payload)).not.toContain('verificationUrl');
  });

  it('rolls back user creation when outbox write fails', async () => {
    const targetEmail = email('rollback');

    const failingRegistration = new PrismaRegistrationUnitOfWork(
      prisma,

      {
        create: jest.fn().mockRejectedValue(new Error('forced outbox failure')),
      } as never,

      moduleRef.get(EmailVerificationUrlBuilder),
    );

    await expect(
      failingRegistration.execute({
        email: targetEmail,

        username: username('rollback'),

        passwordHash: 'password-hash',

        displayName: 'Rollback Reader',

        rawVerificationToken: token('rollback'),

        verificationTokenHash: sha256(token('rollback-hash')),

        verificationExpiresAt: futureDate(30),

        verificationExpiresInMinutes: 30,
      }),
    ).rejects.toBeDefined();

    await expect(
      prisma.user.findUnique({
        where: {
          email: targetEmail,
        },
      }),
    ).resolves.toBeNull();
  });

  it('rejects case-insensitive duplicate email and username', async () => {
    const first = await registration.execute({
      email: email('duplicate'),

      username: username('duplicate'),

      passwordHash: 'password-hash',

      displayName: 'Duplicate Reader',

      rawVerificationToken: token('duplicate-first'),

      verificationTokenHash: sha256(token('duplicate-first')),

      verificationExpiresAt: futureDate(30),

      verificationExpiresInMinutes: 30,
    });

    expect(first.id).toBeDefined();

    await expect(
      registration.execute({
        email: email('duplicate').toUpperCase(),

        username: username('different'),

        passwordHash: 'password-hash',

        displayName: 'Duplicate Email',

        rawVerificationToken: token('duplicate-email'),

        verificationTokenHash: sha256(token('duplicate-email')),

        verificationExpiresAt: futureDate(30),

        verificationExpiresInMinutes: 30,
      }),
    ).rejects.toMatchObject({
      code: 'AUTH_EMAIL_ALREADY_IN_USE',
    });

    await expect(
      registration.execute({
        email: email('different'),

        username: username('duplicate').toUpperCase(),

        passwordHash: 'password-hash',

        displayName: 'Duplicate Username',

        rawVerificationToken: token('duplicate-username'),

        verificationTokenHash: sha256(token('duplicate-username')),

        verificationExpiresAt: futureDate(30),

        verificationExpiresInMinutes: 30,
      }),
    ).rejects.toMatchObject({
      code: 'AUTH_USERNAME_ALREADY_IN_USE',
    });
  });

  it('allows only one concurrent verification claim', async () => {
    const user = await createUser('verification', {
      emailVerified: false,
    });
    const rawToken = token('verification');

    await prisma.userToken.create({
      data: {
        userId: user.id,

        type: TokenType.EMAIL_VERIFICATION,

        tokenHash: sha256(rawToken),

        expiresAt: futureDate(30),
      },
    });

    const results = await Promise.all([
      verification.consume({
        tokenHash: sha256(rawToken),

        verifiedAt: new Date(),
      }),

      verification.consume({
        tokenHash: sha256(rawToken),

        verifiedAt: new Date(),
      }),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual([
      'already_verified',

      'verified',
    ]);

    const freshUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: user.id,
      },
    });

    expect(freshUser.emailVerifiedAt).not.toBeNull();

    const tokens = await prisma.userToken.findMany({
      where: {
        userId: user.id,

        type: TokenType.EMAIL_VERIFICATION,
      },
    });

    expect(tokens.every(({ consumedAt }) => consumedAt !== null)).toBe(true);
  });

  it('consumes reset token once, changes password and revokes every session atomically', async () => {
    const user = await createUser('reset');

    await createSession(user.id, 'reset-one');

    await createSession(user.id, 'reset-two');

    const rawToken = token('reset');

    await prisma.userToken.create({
      data: {
        userId: user.id,

        type: TokenType.PASSWORD_RESET,

        tokenHash: sha256(rawToken),

        expiresAt: futureDate(15),
      },
    });

    /*
     * Hai request sử dụng cùng một reset token.
     *
     * Không được giả định request nào sẽ thắng vì PostgreSQL
     * có quyền lên lịch hai transaction theo thứ tự bất kỳ.
     */
    const attempts = [
      {
        passwordHash: 'new-password-hash',

        resetAt: new Date(),
      },

      {
        passwordHash: 'another-password-hash',

        resetAt: new Date(),
      },
    ] as const;

    const results = await Promise.all(
      attempts.map(async (attempt) => ({
        passwordHash: attempt.passwordHash,

        result: await passwordReset.reset({
          tokenHash: sha256(rawToken),

          passwordHash: attempt.passwordHash,

          resetAt: attempt.resetAt,
        }),
      })),
    );

    const successfulAttempts = results.filter(
      ({ result }) => result.status === 'reset',
    );

    const invalidAttempts = results.filter(
      ({ result }) => result.status === 'invalid',
    );

    /*
     * Compare-and-swap phải bảo đảm chỉ một request thắng.
     */
    expect(successfulAttempts).toHaveLength(1);

    expect(invalidAttempts).toHaveLength(1);

    const successfulAttempt = successfulAttempts[0];

    if (!successfulAttempt) {
      throw new Error(
        'Expected exactly one successful password reset attempt.',
      );
    }

    const freshUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: user.id,
      },
    });

    /*
     * Password cuối cùng phải khớp với request thực sự thắng,
     * không phụ thuộc vào vị trí request trong Promise.all.
     */
    expect(freshUser.passwordHash).toBe(successfulAttempt.passwordHash);

    const tokens = await prisma.userToken.findMany({
      where: {
        userId: user.id,

        type: TokenType.PASSWORD_RESET,
      },
    });

    expect(tokens).toHaveLength(1);

    expect(tokens.every(({ consumedAt }) => consumedAt !== null)).toBe(true);

    const sessions = await prisma.session.findMany({
      where: {
        userId: user.id,
      },
    });

    expect(sessions).toHaveLength(2);

    expect(sessions.every(({ revokedAt }) => revokedAt !== null)).toBe(true);

    expect(
      sessions.every(
        ({ revokedReason }) =>
          revokedReason === SessionRevocationReason.PASSWORD_RESET,
      ),
    ).toBe(true);

    expect(
      sessions.every(({ accessTokenVersion }) => accessTokenVersion === 1),
    ).toBe(true);

    expect(
      sessions.every(({ refreshTokenVersion }) => refreshTokenVersion === 1),
    ).toBe(true);
  });

  it('allows one refresh rotation and treats the competing request as reuse', async () => {
    const user = await createUser('refresh-race');

    const sessionId = randomUUID();

    const familyId = randomUUID();

    const oldRefreshToken = 'old-refresh-token';

    await prisma.session.create({
      data: {
        id: sessionId,

        userId: user.id,

        refreshTokenHash: sha256(oldRefreshToken),

        refreshTokenFamilyId: familyId,

        refreshTokenVersion: 0,

        accessTokenVersion: 0,

        lastUsedAt: new Date(),

        expiresAt: futureDate(60 * 24),
      },
    });

    let issuedCount = 0;

    const handler = new RefreshTokenCommandHandler(
      {
        verify: jest.fn().mockReturnValue({
          userId: user.id,

          sessionId,

          familyId,

          version: 0,
        }),
      },

      refreshPersistence,

      {
        issue: jest.fn(() => {
          issuedCount += 1;

          return {
            accessToken: `access-${issuedCount}`,

            refreshToken: `refresh-${issuedCount}`,

            accessTokenExpiresInSeconds: 900,

            refreshTokenExpiresInSeconds: 2_592_000,

            accessTokenExpiresAt: futureDate(15),

            refreshTokenExpiresAt: futureDate(60 * 24),
          };
        }),
      },

      {
        hash: jest.fn((value: string) => sha256(value)),

        equalsHash: jest.fn(
          (
            left: string,

            right: string,
          ) => left === right,
        ),
      } as never,
    );

    const results = await Promise.allSettled([
      handler.execute(
        new RefreshTokenCommand(
          oldRefreshToken,

          {
            ipAddress: '127.0.0.1',
          },
        ),
      ),

      handler.execute(
        new RefreshTokenCommand(
          oldRefreshToken,

          {
            ipAddress: '127.0.0.1',
          },
        ),
      ),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );

    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );

    const rejected = results.find(({ status }) => status === 'rejected');

    expect(rejected).toMatchObject({
      reason: {
        code: 'AUTH_REFRESH_TOKEN_REUSE_DETECTED',
      },
    });

    const session = await prisma.session.findUniqueOrThrow({
      where: {
        id: sessionId,
      },
    });

    expect(session.revokedAt).not.toBeNull();

    expect(session.revokedReason).toBe(
      SessionRevocationReason.REFRESH_TOKEN_REUSE_DETECTED,
    );

    expect(session.accessTokenVersion).toBeGreaterThanOrEqual(1);
  });

  it('logout-all revokes only sessions belonging to the selected user', async () => {
    const firstUser = await createUser('logout-all-first');

    const secondUser = await createUser('logout-all-second');

    await createSession(firstUser.id, 'first-one');

    await createSession(firstUser.id, 'first-two');

    const otherSession = await createSession(secondUser.id, 'second-one');

    const revoked = await refreshPersistence.revokeAllUserSessions({
      userId: firstUser.id,

      revokedAt: new Date(),

      reason: SessionRevocationReason.USER_LOGOUT_ALL,
    });

    expect(revoked).toBe(2);

    const firstSessions = await prisma.session.findMany({
      where: {
        userId: firstUser.id,
      },
    });

    expect(firstSessions.every(({ revokedAt }) => revokedAt !== null)).toBe(
      true,
    );

    const untouched = await prisma.session.findUniqueOrThrow({
      where: {
        id: otherSession.id,
      },
    });

    expect(untouched.revokedAt).toBeNull();
  });

  async function createUser(
    name: string,

    options: {
      emailVerified?: boolean;
    } = {},
  ) {
    const emailVerified = options.emailVerified ?? true;

    return prisma.user.create({
      data: {
        email: email(name),

        username: username(name),

        passwordHash: 'password-hash',

        displayName: `User ${name}`,

        emailVerifiedAt: emailVerified ? new Date() : null,
      },
    });
  }

  async function createSession(
    userId: string,

    name: string,
  ) {
    return prisma.session.create({
      data: {
        userId,

        refreshTokenHash: sha256(`${runId}:${name}:refresh`),

        refreshTokenFamilyId: randomUUID(),

        refreshTokenVersion: 0,

        accessTokenVersion: 0,

        lastUsedAt: new Date(),

        expiresAt: futureDate(60 * 24),
      },
    });
  }

  async function cleanupRun() {
    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: runId,
        },
      },

      select: {
        id: true,
      },
    });

    const userIds = users.map(({ id }) => id);

    if (userIds.length > 0) {
      await prisma.outboxEvent.deleteMany({
        where: {
          aggregateId: {
            in: userIds,
          },
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: userIds,
          },
        },
      });
    }
  }

  function email(name: string): string {
    return `${sanitize(name)}.${runId}@example.test`;
  }

  function username(name: string): string {
    return `${sanitize(name)}_${runId.replaceAll('-', '').slice(0, 12)}`;
  }

  function token(name: string): string {
    return Buffer.from(`${runId}:${name}:${'x'.repeat(64)}`)
      .toString('base64url')
      .slice(0, 64);
  }

  function sanitize(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/gu, '_');
  }

  function futureDate(minutes: number): Date {
    return new Date(Date.now() + minutes * 60_000);
  }
});

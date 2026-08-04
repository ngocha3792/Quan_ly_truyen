import { PermissionCode, RoleCode } from '@/common/enums';

import {
  AuthenticationRequiredException,
  InvalidInputException,
  ServiceUnavailableException,
} from '@/common/exceptions';

import { AuthAccountStatus, SessionRevocationReason } from '../domain/enums';

import {
  EmailVerificationTokenExpiredException,
  InvalidEmailVerificationTokenException,
  InvalidLoginCredentialsException,
  InvalidPasswordResetTokenException,
  InvalidRefreshTokenException,
  PasswordResetTokenExpiredException,
  RefreshTokenReuseDetectedException,
} from '../domain/exceptions';

import {
  ForgotPasswordCommand,
  ForgotPasswordCommandHandler,
  GetCurrentUserQuery,
  GetCurrentUserQueryHandler,
  GetSessionsQuery,
  GetSessionsQueryHandler,
  LoginCommand,
  LoginCommandHandler,
  LogoutAllCommand,
  LogoutAllCommandHandler,
  LogoutCommand,
  LogoutCommandHandler,
  RefreshTokenCommand,
  RefreshTokenCommandHandler,
  RegisterCommand,
  RegisterCommandHandler,
  ResendEmailVerificationCommand,
  ResendEmailVerificationCommandHandler,
  ResetPasswordCommand,
  ResetPasswordCommandHandler,
  RevokeAccessTokenCommand,
  RevokeAccessTokenCommandHandler,
  RevokeSessionCommand,
  RevokeSessionCommandHandler,
  VerifyEmailCommand,
  VerifyEmailCommandHandler,
} from './index';

const USER_ID = '11111111-1111-4111-8111-111111111111';

const SESSION_ID = '22222222-2222-4222-8222-222222222222';

const SECOND_SESSION_ID = '33333333-3333-4333-8333-333333333333';

const FAMILY_ID = '44444444-4444-4444-8444-444444444444';

const TOKEN_ID = '55555555-5555-4555-8555-555555555555';

const RAW_TOKEN = 'A'.repeat(43);

const NOW = new Date('2026-08-03T06:00:00.000Z');

describe('Auth application handlers', () => {
  beforeEach(() => {
    jest.useFakeTimers();

    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();

    jest.restoreAllMocks();
  });

  describe('RegisterCommandHandler', () => {
    it('normalizes input, hashes password and creates registration transaction', async () => {
      const passwordHasher = {
        hash: jest.fn().mockResolvedValue('password-hash'),
      };

      const secureToken = {
        generate: jest.fn().mockReturnValue(RAW_TOKEN),

        hash: jest.fn().mockReturnValue('verification-token-hash'),
      };

      const registration = {
        execute: jest.fn().mockResolvedValue({
          id: USER_ID,

          email: 'reader@example.com',

          username: 'reader_01',

          displayName: 'Reader One',
        }),
      };

      const handler = new RegisterCommandHandler(
        passwordHasher as never,

        secureToken as never,

        registration,
      );

      const result = await handler.execute(
        new RegisterCommand(
          ' Reader@Example.COM ',

          ' Reader_01 ',

          'StrongPass123!',

          ' Reader   One ',
        ),
      );

      expect(passwordHasher.hash).toHaveBeenCalledWith('StrongPass123!');

      expect(secureToken.hash).toHaveBeenCalledWith(RAW_TOKEN);

      expect(registration.execute).toHaveBeenCalledWith({
        email: 'reader@example.com',

        username: 'reader_01',

        passwordHash: 'password-hash',

        displayName: 'Reader One',

        rawVerificationToken: RAW_TOKEN,

        verificationTokenHash: 'verification-token-hash',

        verificationExpiresAt: new Date('2026-08-03T06:30:00.000Z'),

        verificationExpiresInMinutes: 30,
      });

      expect(result).toEqual({
        id: USER_ID,

        email: 'reader@example.com',

        username: 'reader_01',

        displayName: 'Reader One',

        verificationRequired: true,
      });

      expect(JSON.stringify(result)).not.toContain(RAW_TOKEN);

      expect(JSON.stringify(result)).not.toContain('password-hash');
    });
  });

  describe('LoginCommandHandler', () => {
    function account() {
      return {
        id: USER_ID,

        email: 'reader@example.com',

        username: 'reader',

        displayName: 'Reader',

        passwordHash: 'stored-password-hash',

        status: AuthAccountStatus.ACTIVE,

        deletedAt: null,

        emailVerifiedAt: new Date('2026-08-02T00:00:00.000Z'),

        roles: [RoleCode.USER],
      };
    }

    function issuedTokens() {
      return {
        accessToken: 'access-token',

        refreshToken: 'refresh-token',

        accessTokenExpiresInSeconds: 900,

        refreshTokenExpiresInSeconds: 2_592_000,

        accessTokenExpiresAt: new Date('2026-08-03T06:15:00.000Z'),

        refreshTokenExpiresAt: new Date('2026-09-02T06:00:00.000Z'),
      };
    }

    it('creates a session after successful authentication', async () => {
      const persistence = {
        findAccountByIdentifier: jest.fn().mockResolvedValue(account()),

        createSession: jest.fn().mockResolvedValue(undefined),
      };

      const rateLimiter = {
        assertAllowed: jest.fn().mockResolvedValue(undefined),

        recordFailure: jest.fn(),

        resetAfterSuccess: jest.fn().mockResolvedValue(undefined),
      };

      const passwordHasher = {
        verify: jest.fn().mockResolvedValue(true),
      };

      const tokenIssuer = {
        issue: jest.fn().mockReturnValue(issuedTokens()),
      };

      const secureToken = {
        hash: jest.fn().mockReturnValue('refresh-token-hash'),
      };

      const idGenerator = {
        generate: jest
          .fn()
          .mockReturnValueOnce(SESSION_ID)
          .mockReturnValueOnce(FAMILY_ID),
      };

      const handler = new LoginCommandHandler(
        persistence,

        rateLimiter,

        passwordHasher as never,

        tokenIssuer,

        secureToken as never,

        idGenerator,
      );

      const result = await handler.execute(
        new LoginCommand(
          ' Reader@Example.com ',

          'StrongPass123!',

          {
            ipAddress: '127.0.0.1',

            userAgent: 'Jest',

            deviceId: 'browser-1',

            deviceName: 'Chrome Test',
          },
        ),
      );

      expect(rateLimiter.assertAllowed).toHaveBeenCalledWith({
        identifier: 'reader@example.com',

        ipAddress: '127.0.0.1',
      });

      expect(passwordHasher.verify).toHaveBeenCalledWith(
        'StrongPass123!',

        'stored-password-hash',
      );

      expect(rateLimiter.resetAfterSuccess).toHaveBeenCalled();

      expect(persistence.createSession).toHaveBeenCalledWith({
        id: SESSION_ID,

        userId: USER_ID,

        refreshTokenHash: 'refresh-token-hash',

        refreshTokenFamilyId: FAMILY_ID,

        refreshTokenVersion: 0,

        accessTokenVersion: 0,

        deviceId: 'browser-1',

        deviceName: 'Chrome Test',

        ipAddress: '127.0.0.1',

        userAgent: 'Jest',

        loggedInAt: NOW,

        expiresAt: new Date('2026-09-02T06:00:00.000Z'),
      });

      expect(result).toMatchObject({
        sessionId: SESSION_ID,

        accessToken: 'access-token',

        refreshToken: 'refresh-token',

        tokenType: 'Bearer',

        user: {
          id: USER_ID,

          email: 'reader@example.com',

          username: 'reader',

          emailVerified: true,
        },
      });
    });

    it('uses the dummy bcrypt path and records failure when user is absent', async () => {
      const persistence = {
        findAccountByIdentifier: jest.fn().mockResolvedValue(null),

        createSession: jest.fn(),
      };

      const rateLimiter = {
        assertAllowed: jest.fn().mockResolvedValue(undefined),

        recordFailure: jest.fn().mockResolvedValue(undefined),

        resetAfterSuccess: jest.fn(),
      };

      const passwordHasher = {
        verify: jest.fn().mockResolvedValue(false),
      };

      const handler = new LoginCommandHandler(
        persistence,

        rateLimiter,

        passwordHasher as never,

        {
          issue: jest.fn(),
        },

        {
          hash: jest.fn(),
        } as never,

        {
          generate: jest.fn(),
        },
      );

      await expect(
        handler.execute(
          new LoginCommand(
            'missing@example.com',

            'WrongPass123!',

            {
              ipAddress: '127.0.0.1',
            },
          ),
        ),
      ).rejects.toBeInstanceOf(InvalidLoginCredentialsException);

      expect(passwordHasher.verify).toHaveBeenCalledWith(
        'WrongPass123!',

        expect.any(String),
      );

      expect(rateLimiter.recordFailure).toHaveBeenCalled();

      expect(persistence.createSession).not.toHaveBeenCalled();
    });

    it('records a failure when account policy rejects login', async () => {
      const persistence = {
        findAccountByIdentifier: jest.fn().mockResolvedValue({
          ...account(),

          emailVerifiedAt: null,
        }),

        createSession: jest.fn(),
      };

      const rateLimiter = {
        assertAllowed: jest.fn().mockResolvedValue(undefined),

        recordFailure: jest.fn().mockResolvedValue(undefined),

        resetAfterSuccess: jest.fn(),
      };

      const handler = new LoginCommandHandler(
        persistence,

        rateLimiter,

        {
          verify: jest.fn().mockResolvedValue(true),
        } as never,

        {
          issue: jest.fn(),
        },

        {
          hash: jest.fn(),
        } as never,

        {
          generate: jest.fn(),
        },
      );

      await expect(
        handler.execute(
          new LoginCommand(
            'reader@example.com',

            'StrongPass123!',

            {},
          ),
        ),
      ).rejects.toMatchObject({
        code: 'AUTH_EMAIL_NOT_VERIFIED',
      });

      expect(rateLimiter.recordFailure).toHaveBeenCalled();

      expect(rateLimiter.resetAfterSuccess).not.toHaveBeenCalled();

      expect(persistence.createSession).not.toHaveBeenCalled();
    });
  });

  describe('RefreshTokenCommandHandler', () => {
    function sessionSnapshot() {
      return {
        sessionId: SESSION_ID,

        userId: USER_ID,

        refreshTokenHash: 'hash:old-refresh-token',

        refreshTokenFamilyId: FAMILY_ID,

        refreshTokenVersion: 0,

        accessTokenVersion: 2,

        expiresAt: new Date('2026-09-02T06:00:00.000Z'),

        revokedAt: null as Date | null,

        accountStatus: AuthAccountStatus.ACTIVE,

        userDeletedAt: null as Date | null,
      };
    }

    function createHandler(
      overrides: {
        rotate?: boolean;

        session?: ReturnType<typeof sessionSnapshot>;

        verifiedVersion?: number;

        equalsHash?: boolean;
      } = {},
    ) {
      const tokenVerifier = {
        verify: jest.fn().mockReturnValue({
          userId: USER_ID,

          sessionId: SESSION_ID,

          familyId: FAMILY_ID,

          version: overrides.verifiedVersion ?? 0,
        }),
      };

      const persistence = {
        findBySessionId: jest
          .fn()
          .mockResolvedValue(overrides.session ?? sessionSnapshot()),

        rotate: jest.fn().mockResolvedValue(overrides.rotate ?? true),

        revokeFamily: jest.fn().mockResolvedValue(undefined),
      };

      const tokenIssuer = {
        issue: jest.fn().mockReturnValue({
          accessToken: 'next-access-token',

          refreshToken: 'next-refresh-token',

          accessTokenExpiresInSeconds: 900,

          refreshTokenExpiresInSeconds: 2_592_000,

          accessTokenExpiresAt: new Date('2026-08-03T06:15:00.000Z'),

          refreshTokenExpiresAt: new Date('2026-09-02T06:00:00.000Z'),
        }),
      };

      const secureToken = {
        hash: jest.fn((value: string) => `hash:${value}`),

        equalsHash: jest.fn().mockReturnValue(overrides.equalsHash ?? true),
      };

      return {
        handler: new RefreshTokenCommandHandler(
          tokenVerifier,

          persistence as never,

          tokenIssuer,

          secureToken as never,
        ),

        tokenVerifier,

        persistence,

        tokenIssuer,

        secureToken,
      };
    }

    it('rotates a valid refresh token using compare-and-swap', async () => {
      const { handler, persistence, tokenIssuer } = createHandler();

      const result = await handler.execute(
        new RefreshTokenCommand(
          'old-refresh-token',

          {
            ipAddress: '127.0.0.1',

            userAgent: 'Jest',
          },
        ),
      );

      expect(tokenIssuer.issue).toHaveBeenCalledWith({
        userId: USER_ID,

        sessionId: SESSION_ID,

        refreshTokenFamilyId: FAMILY_ID,

        accessTokenVersion: 2,

        refreshTokenVersion: 1,
      });

      expect(persistence.rotate).toHaveBeenCalledWith({
        sessionId: SESSION_ID,

        userId: USER_ID,

        familyId: FAMILY_ID,

        expectedRefreshTokenHash: 'hash:old-refresh-token',

        expectedRefreshTokenVersion: 0,

        nextRefreshTokenHash: 'hash:next-refresh-token',

        nextRefreshTokenVersion: 1,

        rotatedAt: NOW,

        ipAddress: '127.0.0.1',

        userAgent: 'Jest',
      });

      expect(result).toMatchObject({
        sessionId: SESSION_ID,

        accessToken: 'next-access-token',

        refreshToken: 'next-refresh-token',
      });
    });

    it('revokes the token family when a stale version is reused', async () => {
      const { handler, persistence } = createHandler({
        verifiedVersion: 0,

        session: {
          ...sessionSnapshot(),

          refreshTokenVersion: 1,
        },
      });

      await expect(
        handler.execute(
          new RefreshTokenCommand(
            'old-refresh-token',

            {},
          ),
        ),
      ).rejects.toBeInstanceOf(RefreshTokenReuseDetectedException);

      expect(persistence.revokeFamily).toHaveBeenCalledWith({
        userId: USER_ID,

        sessionId: SESSION_ID,

        familyId: FAMILY_ID,

        revokedAt: NOW,

        reason: SessionRevocationReason.REFRESH_TOKEN_REUSE_DETECTED,
      });

      expect(persistence.rotate).not.toHaveBeenCalled();
    });

    it('revokes the family when CAS loses a concurrent rotation race', async () => {
      const { handler, persistence } = createHandler({
        rotate: false,
      });

      await expect(
        handler.execute(
          new RefreshTokenCommand(
            'old-refresh-token',

            {},
          ),
        ),
      ).rejects.toBeInstanceOf(RefreshTokenReuseDetectedException);

      expect(persistence.revokeFamily).toHaveBeenCalledWith({
        userId: USER_ID,

        sessionId: SESSION_ID,

        familyId: FAMILY_ID,

        revokedAt: NOW,

        reason: SessionRevocationReason.REFRESH_TOKEN_REUSE_DETECTED,
      });
    });

    it('rejects a revoked session', async () => {
      const { handler } = createHandler({
        session: {
          ...sessionSnapshot(),

          revokedAt: NOW,
        },
      });

      await expect(
        handler.execute(
          new RefreshTokenCommand(
            'old-refresh-token',

            {},
          ),
        ),
      ).rejects.toBeInstanceOf(InvalidRefreshTokenException);
    });
  });

  describe('Logout handlers', () => {
    it('treats missing refresh cookie as an idempotent logout', async () => {
      const tokenVerifier = {
        verify: jest.fn(),
      };

      const persistence = {
        revokeCurrentSession: jest.fn(),
      };

      const handler = new LogoutCommandHandler(
        tokenVerifier,

        persistence as never,
      );

      await expect(
        handler.execute(new LogoutCommand(undefined)),
      ).resolves.toBeUndefined();

      expect(tokenVerifier.verify).not.toHaveBeenCalled();

      expect(persistence.revokeCurrentSession).not.toHaveBeenCalled();
    });

    it('revokes the session represented by the refresh token', async () => {
      const tokenVerifier = {
        verify: jest.fn().mockReturnValue({
          userId: USER_ID,

          sessionId: SESSION_ID,

          familyId: FAMILY_ID,

          version: 0,
        }),
      };

      const persistence = {
        revokeCurrentSession: jest.fn().mockResolvedValue(undefined),
      };

      const handler = new LogoutCommandHandler(
        tokenVerifier,

        persistence as never,
      );

      await handler.execute(new LogoutCommand('refresh-token'));

      expect(persistence.revokeCurrentSession).toHaveBeenCalledWith({
        sessionId: SESSION_ID,

        userId: USER_ID,

        familyId: FAMILY_ID,

        revokedAt: NOW,

        reason: SessionRevocationReason.USER_LOGOUT,
      });
    });

    it('swallows only invalid refresh token errors', async () => {
      const tokenVerifier = {
        verify: jest.fn().mockImplementation(() => {
          throw new InvalidRefreshTokenException();
        }),
      };

      const handler = new LogoutCommandHandler(
        tokenVerifier,

        {
          revokeCurrentSession: jest.fn(),
        } as never,
      );

      await expect(
        handler.execute(new LogoutCommand('invalid-token')),
      ).resolves.toBeUndefined();
    });

    it('propagates database failures during logout', async () => {
      const infrastructureError = new Error('database unavailable');

      const handler = new LogoutCommandHandler(
        {
          verify: jest.fn().mockReturnValue({
            userId: USER_ID,

            sessionId: SESSION_ID,

            familyId: FAMILY_ID,

            version: 0,
          }),
        },

        {
          revokeCurrentSession: jest
            .fn()
            .mockRejectedValue(infrastructureError),
        } as never,
      );

      await expect(
        handler.execute(new LogoutCommand('refresh-token')),
      ).rejects.toBe(infrastructureError);
    });

    it('revokes every session for logout-all', async () => {
      const persistence = {
        revokeAllUserSessions: jest.fn().mockResolvedValue(3),
      };

      const handler = new LogoutAllCommandHandler(persistence as never);

      await handler.execute(new LogoutAllCommand(USER_ID, SESSION_ID));

      expect(persistence.revokeAllUserSessions).toHaveBeenCalledTimes(1);

      expect(persistence.revokeAllUserSessions).toHaveBeenCalledWith({
        userId: USER_ID,

        actorSessionId: SESSION_ID,

        revokedAt: NOW,

        reason: SessionRevocationReason.USER_LOGOUT_ALL,
      });
    });

    it('never passes an undefined user ID to persistence', async () => {
      const persistence = {
        revokeAllUserSessions: jest.fn(),
      };

      const handler = new LogoutAllCommandHandler(persistence as never);

      await expect(
        handler.execute(new LogoutAllCommand(undefined, SESSION_ID)),
      ).rejects.toBeInstanceOf(AuthenticationRequiredException);

      expect(persistence.revokeAllUserSessions).not.toHaveBeenCalled();
    });
  });

  describe('Email verification', () => {
    it('hashes and consumes a verification token', async () => {
      const persistence = {
        consume: jest.fn().mockResolvedValue({
          status: 'verified',

          userId: USER_ID,

          email: 'reader@example.com',

          verifiedAt: NOW,
        }),
      };

      const handler = new VerifyEmailCommandHandler(
        persistence,

        {
          hash: jest.fn().mockReturnValue('verification-hash'),
        } as never,
      );

      const result = await handler.execute(new VerifyEmailCommand(RAW_TOKEN));

      expect(persistence.consume).toHaveBeenCalledWith({
        tokenHash: 'verification-hash',

        verifiedAt: NOW,
      });

      expect(result).toEqual({
        emailVerified: true,

        alreadyVerified: false,

        verifiedAt: NOW,
      });
    });

    it('maps expired verification token', async () => {
      const expiresAt = new Date('2026-08-03T05:00:00.000Z');

      const handler = new VerifyEmailCommandHandler(
        {
          consume: jest.fn().mockResolvedValue({
            status: 'expired',

            expiresAt,
          }),
        },

        {
          hash: jest.fn().mockReturnValue('verification-hash'),
        } as never,
      );

      await expect(
        handler.execute(new VerifyEmailCommand(RAW_TOKEN)),
      ).rejects.toBeInstanceOf(EmailVerificationTokenExpiredException);
    });

    it('maps unknown verification token', async () => {
      const handler = new VerifyEmailCommandHandler(
        {
          consume: jest.fn().mockResolvedValue({
            status: 'invalid',
          }),
        },

        {
          hash: jest.fn().mockReturnValue('verification-hash'),
        } as never,
      );

      await expect(
        handler.execute(new VerifyEmailCommand(RAW_TOKEN)),
      ).rejects.toBeInstanceOf(InvalidEmailVerificationTokenException);
    });
  });

  describe('Resend verification', () => {
    it('returns the anti-enumeration response during cooldown', async () => {
      const persistence = {
        execute: jest.fn(),
      };

      const handler = new ResendEmailVerificationCommandHandler(
        {
          tryAcquire: jest.fn().mockResolvedValue(false),

          release: jest.fn(),
        },

        persistence,

        {
          generate: jest.fn(),

          hash: jest.fn(),
        } as never,
      );

      const result = await handler.execute(
        new ResendEmailVerificationCommand(' Reader@Example.com '),
      );

      expect(result.accepted).toBe(true);

      expect(persistence.execute).not.toHaveBeenCalled();
    });

    it('releases cooldown when database/outbox fails', async () => {
      const originalError = new Error('outbox failed');

      const cooldown = {
        tryAcquire: jest.fn().mockResolvedValue(true),

        release: jest.fn().mockResolvedValue(undefined),
      };

      const handler = new ResendEmailVerificationCommandHandler(
        cooldown,

        {
          execute: jest.fn().mockRejectedValue(originalError),
        },

        {
          generate: jest.fn().mockReturnValue(RAW_TOKEN),

          hash: jest.fn().mockReturnValue('verification-hash'),
        } as never,
      );

      await expect(
        handler.execute(
          new ResendEmailVerificationCommand('reader@example.com'),
        ),
      ).rejects.toBe(originalError);

      expect(cooldown.release).toHaveBeenCalledWith('reader@example.com');
    });
  });

  describe('Forgot/reset password', () => {
    it('does not reveal whether an email exists', async () => {
      const persistence = {
        request: jest.fn().mockResolvedValue('ignored'),
      };

      const handler = new ForgotPasswordCommandHandler(
        {
          tryAcquire: jest.fn().mockResolvedValue(true),

          release: jest.fn(),
        },

        persistence as never,

        {
          generate: jest.fn().mockReturnValue(RAW_TOKEN),

          hash: jest.fn().mockReturnValue('reset-hash'),
        } as never,
      );

      const result = await handler.execute(
        new ForgotPasswordCommand(' Missing@Example.com '),
      );

      expect(result.accepted).toBe(true);

      expect(persistence.request).toHaveBeenCalledWith({
        email: 'missing@example.com',

        rawToken: RAW_TOKEN,

        tokenHash: 'reset-hash',

        expiresAt: new Date('2026-08-03T06:15:00.000Z'),

        expiresInMinutes: 15,
      });

      expect(JSON.stringify(result)).not.toContain(RAW_TOKEN);
    });

    it('releases reset cooldown after persistence failure', async () => {
      const originalError = new Error('database unavailable');

      const cooldown = {
        tryAcquire: jest.fn().mockResolvedValue(true),

        release: jest.fn().mockResolvedValue(undefined),
      };

      const handler = new ForgotPasswordCommandHandler(
        cooldown,

        {
          request: jest.fn().mockRejectedValue(originalError),
        } as never,

        {
          generate: jest.fn().mockReturnValue(RAW_TOKEN),

          hash: jest.fn().mockReturnValue('reset-hash'),
        } as never,
      );

      await expect(
        handler.execute(new ForgotPasswordCommand('reader@example.com')),
      ).rejects.toBe(originalError);

      expect(cooldown.release).toHaveBeenCalledWith('reader@example.com');
    });

    it('hashes the new password and consumes reset token', async () => {
      const persistence = {
        reset: jest.fn().mockResolvedValue({
          status: 'reset',

          userId: USER_ID,

          email: 'reader@example.com',

          sessionsRevoked: 2,

          resetAt: NOW,
        }),
      };

      const passwordHasher = {
        hash: jest.fn().mockResolvedValue('new-password-hash'),
      };

      const secureToken = {
        hash: jest.fn().mockReturnValue('reset-token-hash'),
      };

      const handler = new ResetPasswordCommandHandler(
        persistence as never,

        passwordHasher as never,

        secureToken as never,
      );

      const result = await handler.execute(
        new ResetPasswordCommand(
          RAW_TOKEN,

          'NewStrongPass123!',
        ),
      );

      expect(passwordHasher.hash).toHaveBeenCalledWith('NewStrongPass123!');

      expect(persistence.reset).toHaveBeenCalledWith({
        tokenHash: 'reset-token-hash',

        passwordHash: 'new-password-hash',

        resetAt: NOW,
      });

      expect(result).toEqual({
        passwordReset: true,

        sessionsRevoked: 2,

        resetAt: NOW,
      });

      expect(JSON.stringify(result)).not.toContain('new-password-hash');
    });

    it('maps an expired reset token', async () => {
      const handler = new ResetPasswordCommandHandler(
        {
          reset: jest.fn().mockResolvedValue({
            status: 'expired',

            expiresAt: new Date('2026-08-03T05:00:00.000Z'),
          }),
        } as never,

        {
          hash: jest.fn().mockResolvedValue('password-hash'),
        } as never,

        {
          hash: jest.fn().mockReturnValue('reset-hash'),
        } as never,
      );

      await expect(
        handler.execute(
          new ResetPasswordCommand(
            RAW_TOKEN,

            'NewStrongPass123!',
          ),
        ),
      ).rejects.toBeInstanceOf(PasswordResetTokenExpiredException);
    });

    it('maps an invalid reset token', async () => {
      const handler = new ResetPasswordCommandHandler(
        {
          reset: jest.fn().mockResolvedValue({
            status: 'invalid',
          }),
        } as never,

        {
          hash: jest.fn().mockResolvedValue('password-hash'),
        } as never,

        {
          hash: jest.fn().mockReturnValue('reset-hash'),
        } as never,
      );

      await expect(
        handler.execute(
          new ResetPasswordCommand(
            RAW_TOKEN,

            'NewStrongPass123!',
          ),
        ),
      ).rejects.toBeInstanceOf(InvalidPasswordResetTokenException);
    });
  });

  describe('Current user and sessions', () => {
    it('returns the current user without token secrets', async () => {
      const reader = {
        findById: jest.fn().mockResolvedValue({
          id: USER_ID,

          email: 'reader@example.com',

          username: 'reader',

          displayName: 'Reader',

          bio: null,

          status: AuthAccountStatus.ACTIVE,

          emailVerifiedAt: new Date('2026-08-02T00:00:00.000Z'),

          lastLoginAt: NOW,

          avatar: null,

          authorProfile: null,

          roles: [RoleCode.USER],

          permissions: [PermissionCode.USER_PROFILE_READ],

          createdAt: new Date('2026-08-01T00:00:00.000Z'),

          updatedAt: NOW,
        }),
      };

      const handler = new GetCurrentUserQueryHandler(reader);

      const result = await handler.execute(
        new GetCurrentUserQuery(
          USER_ID,

          SESSION_ID,
        ),
      );

      expect(result).toMatchObject({
        id: USER_ID,

        sessionId: SESSION_ID,

        email: 'reader@example.com',

        emailVerified: true,

        roles: [RoleCode.USER],
      });

      expect(JSON.stringify(result)).not.toMatch(
        /accessToken|refreshToken|passwordHash/u,
      );
    });

    it('rejects an invalid principal before querying database', async () => {
      const reader = {
        findById: jest.fn(),
      };

      const handler = new GetCurrentUserQueryHandler(reader);

      await expect(
        handler.execute(
          new GetCurrentUserQuery(
            undefined,

            SESSION_ID,
          ),
        ),
      ).rejects.toBeInstanceOf(AuthenticationRequiredException);

      expect(reader.findById).not.toHaveBeenCalled();
    });

    it('sorts current session first and then by latest activity', async () => {
      const persistence = {
        listActiveByUserId: jest.fn().mockResolvedValue([
          {
            id: SECOND_SESSION_ID,

            deviceId: null,

            deviceName: 'Second',

            ipAddress: null,

            userAgent: null,

            lastUsedAt: new Date('2026-08-03T05:59:00.000Z'),

            createdAt: new Date('2026-08-03T05:00:00.000Z'),

            expiresAt: new Date('2026-09-03T00:00:00.000Z'),
          },

          {
            id: SESSION_ID,

            deviceId: null,

            deviceName: 'Current',

            ipAddress: null,

            userAgent: null,

            lastUsedAt: new Date('2026-08-01T00:00:00.000Z'),

            createdAt: new Date('2026-08-01T00:00:00.000Z'),

            expiresAt: new Date('2026-09-03T00:00:00.000Z'),
          },
        ]),
      };

      const handler = new GetSessionsQueryHandler(persistence as never);

      const result = await handler.execute(
        new GetSessionsQuery(
          USER_ID,

          SESSION_ID,
        ),
      );

      expect(result.sessions.map(({ id }) => id)).toEqual([
        SESSION_ID,

        SECOND_SESSION_ID,
      ]);

      expect(result.sessions[0]).toMatchObject({
        id: SESSION_ID,

        isCurrent: true,
      });
    });

    it('revokes a user-owned session without exposing existence', async () => {
      const persistence = {
        revokeUserSession: jest.fn().mockResolvedValue(false),
      };

      const handler = new RevokeSessionCommandHandler(persistence as never);

      await expect(
        handler.execute(
          new RevokeSessionCommand(
            USER_ID,

            SESSION_ID,

            SECOND_SESSION_ID,
          ),
        ),
      ).resolves.toBeUndefined();

      expect(persistence.revokeUserSession).toHaveBeenCalledWith({
        userId: USER_ID,

        actorSessionId: SESSION_ID,

        sessionId: SECOND_SESSION_ID,

        revokedAt: NOW,

        reason: SessionRevocationReason.USER_REVOKED_SESSION,
      });
    });

    it('rejects a malformed session ID', async () => {
      const persistence = {
        revokeUserSession: jest.fn(),
      };

      const handler = new RevokeSessionCommandHandler(persistence as never);

      await expect(
        handler.execute(
          new RevokeSessionCommand(
            USER_ID,

            SESSION_ID,

            'invalid-session-id',
          ),
        ),
      ).rejects.toBeInstanceOf(InvalidInputException);

      expect(persistence.revokeUserSession).not.toHaveBeenCalled();
    });
  });

  describe('Revoke access token', () => {
    it('writes the current token to blacklist', async () => {
      const blacklist = {
        blacklist: jest.fn().mockResolvedValue(undefined),
      };

      const handler = new RevokeAccessTokenCommandHandler(blacklist as never);

      const expiresAt = new Date('2026-08-03T06:15:00.000Z');

      await handler.execute(
        new RevokeAccessTokenCommand(
          TOKEN_ID,

          expiresAt,
        ),
      );

      expect(blacklist.blacklist).toHaveBeenCalledWith({
        tokenId: TOKEN_ID,

        expiresAt,

        reason: 'user_revoked_current_access_token',
      });
    });

    it('does not swallow blacklist infrastructure failure', async () => {
      const handler = new RevokeAccessTokenCommandHandler({
        blacklist: jest.fn().mockRejectedValue(
          new ServiceUnavailableException({
            code: 'AUTH_JWT_BLACKLIST_UNAVAILABLE',

            service: 'redis',
          }),
        ),
      } as never);

      await expect(
        handler.execute(
          new RevokeAccessTokenCommand(
            TOKEN_ID,

            new Date('2026-08-03T06:15:00.000Z'),
          ),
        ),
      ).rejects.toMatchObject({
        code: 'AUTH_JWT_BLACKLIST_UNAVAILABLE',
      });
    });
  });
});

import { JwtTokenType, PermissionCode, RoleCode } from '@/common/enums';
import { ServiceUnavailableException } from '@/common/exceptions';

import { ValidateAccessTokenQuery } from './validate-access-token.query';

import { ValidateAccessTokenQueryHandler } from './validate-access-token.query-handler';

describe('ValidateAccessTokenQueryHandler blacklist', () => {
  const payload = {
    sub: '11111111-1111-4111-8111-111111111111',

    sid: '22222222-2222-4222-8222-222222222222',

    jti: '33333333-3333-4333-8333-333333333333',

    typ: JwtTokenType.ACCESS,

    ver: 0,

    iat: 1_775_188_800,

    exp: 1_775_189_700,
  } as const;

  let sessionReader: {
    findBySessionId: jest.Mock;
  };

  let jwtBlacklist: {
    isBlacklisted: jest.Mock;

    blacklist: jest.Mock;
  };

  let handler: ValidateAccessTokenQueryHandler;

  function activeSession(overrides: Record<string, unknown> = {}) {
    return {
      sessionId: payload.sid,
      userId: payload.sub,
      accessTokenVersion: 0,
      expiresAt: new Date('2026-12-01T00:00:00.000Z'),
      revokedAt: null,
      mfaVerifiedAt: null,
      email: 'admin@example.com',
      emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
      accountStatus: 'ACTIVE',
      userDeletedAt: null,
      roles: [RoleCode.ADMIN],
      permissions: [PermissionCode.ROLE_MANAGE],
      ...overrides,
    };
  }

  beforeEach(() => {
    sessionReader = {
      findBySessionId: jest.fn(),
    };

    jwtBlacklist = {
      isBlacklisted: jest.fn(),

      blacklist: jest.fn(),
    };

    handler = new ValidateAccessTokenQueryHandler(
      sessionReader,

      jwtBlacklist,

      { isAdminMfaRequired: () => true, create: jest.fn() },
    );
  });

  it('rejects a blacklisted access token before reading the session', async () => {
    jwtBlacklist.isBlacklisted.mockResolvedValue(true);

    await expect(
      handler.execute(new ValidateAccessTokenQuery(payload)),
    ).rejects.toMatchObject({
      code: 'AUTH_ACCESS_TOKEN_BLACKLISTED',
    });

    expect(jwtBlacklist.isBlacklisted).toHaveBeenCalledWith(payload.jti);

    expect(sessionReader.findBySessionId).not.toHaveBeenCalled();
  });

  it('rejects an admin session that has not completed MFA', async () => {
    jwtBlacklist.isBlacklisted.mockResolvedValue(false);
    sessionReader.findBySessionId.mockResolvedValue(activeSession());

    await expect(
      handler.execute(new ValidateAccessTokenQuery(payload)),
    ).rejects.toMatchObject({ code: 'AUTH_MFA_REQUIRED' });
  });

  it('allows a non-MFA admin session only when MFA is disabled outside production', async () => {
    handler = new ValidateAccessTokenQueryHandler(sessionReader, jwtBlacklist, {
      isAdminMfaRequired: () => false,
      create: jest.fn(),
    });
    jwtBlacklist.isBlacklisted.mockResolvedValue(false);
    sessionReader.findBySessionId.mockResolvedValue(activeSession());

    await expect(
      handler.execute(new ValidateAccessTokenQuery(payload)),
    ).resolves.toMatchObject({
      userId: payload.sub,
      mfaVerified: false,
    });
  });

  it('accepts an admin session after MFA verification', async () => {
    jwtBlacklist.isBlacklisted.mockResolvedValue(false);
    sessionReader.findBySessionId.mockResolvedValue(
      activeSession({ mfaVerifiedAt: new Date('2026-08-03T06:00:00.000Z') }),
    );

    await expect(
      handler.execute(new ValidateAccessTokenQuery(payload)),
    ).resolves.toMatchObject({
      userId: payload.sub,
      sessionId: payload.sid,
      mfaVerified: true,
    });
  });

  it('propagates blacklist failures in fail-closed mode', async () => {
    jwtBlacklist.isBlacklisted.mockRejectedValue(
      new ServiceUnavailableException({
        code: 'AUTH_JWT_BLACKLIST_UNAVAILABLE',

        service: 'redis',
      }),
    );

    await expect(
      handler.execute(new ValidateAccessTokenQuery(payload)),
    ).rejects.toMatchObject({
      code: 'AUTH_JWT_BLACKLIST_UNAVAILABLE',
    });

    expect(sessionReader.findBySessionId).not.toHaveBeenCalled();
  });
});

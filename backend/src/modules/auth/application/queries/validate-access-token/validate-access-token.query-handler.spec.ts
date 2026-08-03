import { JwtTokenType } from '@/common/enums';

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

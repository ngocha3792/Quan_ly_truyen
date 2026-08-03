import { ServiceUnavailableException } from '@/common/exceptions';

import { RevokeAccessTokenCommand } from './revoke-access-token.command';

import { RevokeAccessTokenCommandHandler } from './revoke-access-token.command-handler';

describe('RevokeAccessTokenCommandHandler', () => {
  const tokenId = '11111111-1111-4111-8111-111111111111';

  let jwtBlacklist: {
    blacklist: jest.Mock;

    isBlacklisted: jest.Mock;
  };

  let handler: RevokeAccessTokenCommandHandler;

  beforeEach(() => {
    jwtBlacklist = {
      blacklist: jest.fn().mockResolvedValue(undefined),

      isBlacklisted: jest.fn(),
    };

    handler = new RevokeAccessTokenCommandHandler(jwtBlacklist);
  });

  it('blacklists the current access token', async () => {
    const expiresAt = new Date('2026-08-03T05:00:00.000Z');

    await handler.execute(
      new RevokeAccessTokenCommand(
        tokenId,

        expiresAt,
      ),
    );

    expect(jwtBlacklist.blacklist).toHaveBeenCalledWith({
      tokenId,

      expiresAt,

      reason: 'user_revoked_current_access_token',
    });
  });

  it('rejects missing token metadata', async () => {
    await expect(
      handler.execute(
        new RevokeAccessTokenCommand(
          undefined,

          undefined,
        ),
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_ACCESS_TOKEN_METADATA_INVALID',
    });

    expect(jwtBlacklist.blacklist).not.toHaveBeenCalled();
  });

  it('rejects malformed token IDs', async () => {
    await expect(
      handler.execute(
        new RevokeAccessTokenCommand(
          'not-a-uuid',

          new Date('2026-08-03T05:00:00.000Z'),
        ),
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_ACCESS_TOKEN_METADATA_INVALID',
    });

    expect(jwtBlacklist.blacklist).not.toHaveBeenCalled();
  });

  it('does not swallow blacklist infrastructure failures', async () => {
    jwtBlacklist.blacklist.mockRejectedValue(
      new ServiceUnavailableException({
        code: 'AUTH_JWT_BLACKLIST_UNAVAILABLE',

        service: 'redis',
      }),
    );

    await expect(
      handler.execute(
        new RevokeAccessTokenCommand(
          tokenId,

          new Date('2026-08-03T05:00:00.000Z'),
        ),
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_JWT_BLACKLIST_UNAVAILABLE',
    });
  });
});

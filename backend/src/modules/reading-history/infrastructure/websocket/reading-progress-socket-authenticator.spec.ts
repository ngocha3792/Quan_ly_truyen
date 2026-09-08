import { ConfigService } from '@nestjs/config';
import type { Socket } from 'socket.io';

import { JwtTokenType } from '@/common/enums';
import { signJwt } from '@/common/utils';
import type { AuthConfig } from '@/config';
import type { ValidateAccessTokenQueryHandler } from '@/modules/auth/application';

import { ReadingProgressSocketAuthenticator } from './reading-progress-socket-authenticator';

describe('ReadingProgressSocketAuthenticator', () => {
  const secret = 'socket-access-secret-at-least-32-characters';
  const auth = {
    accessTokenSecret: secret,
    issuer: 'quan-ly-truyen-api',
    audience: 'quan-ly-truyen-web',
  } as AuthConfig;

  it('verifies the JWT then delegates session, blacklist, and MFA checks', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const validator = {
      execute: jest.fn().mockResolvedValue({ userId }),
    } as unknown as ValidateAccessTokenQueryHandler;
    const authenticator = new ReadingProgressSocketAuthenticator(
      {
        getOrThrow: jest.fn().mockReturnValue(auth),
      } as unknown as ConfigService,
      validator,
    );
    const token = signJwt(
      {
        typ: JwtTokenType.ACCESS,
        sid: '22222222-2222-4222-8222-222222222222',
        ver: 0,
      },
      {
        key: secret,
        algorithm: 'HS256',
        expiresIn: 300,
        issuer: auth.issuer,
        audience: auth.audience,
        subject: userId,
        jwtId: '33333333-3333-4333-8333-333333333333',
      },
    );

    await expect(
      authenticator.authenticate({
        handshake: { auth: { accessToken: token } },
      } as unknown as Socket),
    ).resolves.toBe(userId);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(validator.execute).toHaveBeenCalledTimes(1);
  });

  it('rejects a handshake without an auth payload token', async () => {
    const authenticator = new ReadingProgressSocketAuthenticator(
      {
        getOrThrow: jest.fn().mockReturnValue(auth),
      } as unknown as ConfigService,
      { execute: jest.fn() } as unknown as ValidateAccessTokenQueryHandler,
    );

    await expect(
      authenticator.authenticate({
        handshake: { auth: {} },
      } as unknown as Socket),
    ).rejects.toMatchObject({ code: 'READING_PROGRESS_SOCKET_AUTH_REQUIRED' });
  });
});

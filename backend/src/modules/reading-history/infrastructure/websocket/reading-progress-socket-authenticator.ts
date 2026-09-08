import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Socket } from 'socket.io';

import { JwtTokenType } from '@/common/enums';
import { AuthenticationRequiredException } from '@/common/exceptions';
import type { AccessTokenPayload } from '@/common/interfaces/auth';
import { verifyJwt } from '@/common/utils';
import type { AuthConfig } from '@/config';
import {
  ValidateAccessTokenQuery,
  ValidateAccessTokenQueryHandler,
} from '@/modules/auth';

@Injectable()
export class ReadingProgressSocketAuthenticator {
  private readonly auth: AuthConfig;

  constructor(
    config: ConfigService,
    private readonly validateAccessToken: ValidateAccessTokenQueryHandler,
  ) {
    this.auth = config.getOrThrow<AuthConfig>('auth');
  }

  async authenticate(client: Socket): Promise<string> {
    const handshake = client.handshake as unknown;
    const candidate =
      isRecord(handshake) && isRecord(handshake['auth'])
        ? handshake['auth']['accessToken']
        : undefined;
    if (typeof candidate !== 'string' || !candidate) {
      throw new AuthenticationRequiredException({
        code: 'READING_PROGRESS_SOCKET_AUTH_REQUIRED',
        message: 'WebSocket cần access token hợp lệ',
      });
    }

    const payload = verifyJwt<AccessTokenPayload>(candidate, {
      key: this.auth.accessTokenSecret,
      algorithms: ['HS256'],
      issuer: this.auth.issuer,
      audience: this.auth.audience,
    });
    if (payload.typ !== JwtTokenType.ACCESS) {
      throw new AuthenticationRequiredException({
        code: 'READING_PROGRESS_SOCKET_TOKEN_INVALID',
      });
    }
    const principal = await this.validateAccessToken.execute(
      new ValidateAccessTokenQuery(payload),
    );
    return principal.userId;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

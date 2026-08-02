import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtTokenType } from '@/common/enums';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '@/common/interfaces/auth';
import { generateUuid, signJwt } from '@/common/utils';
import type { AuthConfig } from '@/config';

import type {
  AuthTokenIssuerPort,
  IssuedAuthTokens,
  IssueAuthTokensInput,
} from '../../application/ports';

@Injectable()
export class JwtAuthTokenIssuer implements AuthTokenIssuerPort {
  private readonly config: AuthConfig;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<AuthConfig>('auth');
  }

  issue(input: IssueAuthTokensInput): IssuedAuthTokens {
    const issuedAt = Date.now();

    const accessPayload: Omit<
      AccessTokenPayload,
      'sub' | 'iat' | 'exp' | 'jti'
    > = {
      sid: input.sessionId,
      typ: JwtTokenType.ACCESS,
      ver: input.accessTokenVersion,
    };

    const refreshPayload: Omit<
      RefreshTokenPayload,
      'sub' | 'iat' | 'exp' | 'jti'
    > = {
      sid: input.sessionId,
      typ: JwtTokenType.REFRESH,
      ver: input.refreshTokenVersion,
      familyId: input.refreshTokenFamilyId,
    };

    const accessToken = signJwt(accessPayload, {
      key: this.config.accessTokenSecret,
      algorithm: 'HS256',
      expiresIn: this.config.accessTokenTtlSeconds,
      issuer: this.config.issuer,
      audience: this.config.audience,
      subject: input.userId,
      jwtId: generateUuid(),
    });

    const refreshToken = signJwt(refreshPayload, {
      key: this.config.refreshTokenSecret,
      algorithm: 'HS256',
      expiresIn: this.config.refreshTokenTtlSeconds,
      issuer: this.config.issuer,
      audience: this.config.audience,
      subject: input.userId,
      jwtId: generateUuid(),
    });

    return {
      accessToken,
      refreshToken,

      accessTokenExpiresInSeconds: this.config.accessTokenTtlSeconds,
      refreshTokenExpiresInSeconds: this.config.refreshTokenTtlSeconds,

      accessTokenExpiresAt: new Date(
        issuedAt + this.config.accessTokenTtlSeconds * 1000,
      ),
      refreshTokenExpiresAt: new Date(
        issuedAt + this.config.refreshTokenTtlSeconds * 1000,
      ),
    };
  }
}

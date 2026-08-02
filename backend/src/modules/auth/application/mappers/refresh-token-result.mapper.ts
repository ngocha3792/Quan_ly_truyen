import type { RefreshTokenResultDto } from '../dto';
import type { IssuedAuthTokens } from '../ports';

export class RefreshTokenResultMapper {
  static toDto(
    sessionId: string,
    tokens: IssuedAuthTokens,
  ): RefreshTokenResultDto {
    return {
      sessionId,

      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,

      tokenType: 'Bearer',

      accessTokenExpiresInSeconds: tokens.accessTokenExpiresInSeconds,

      accessTokenExpiresAt: tokens.accessTokenExpiresAt,

      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    };
  }
}

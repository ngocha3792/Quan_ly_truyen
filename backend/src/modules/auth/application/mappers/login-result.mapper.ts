import type { LoginResultDto } from '../dto';
import type { IssuedAuthTokens, LoginAccountRecord } from '../ports';

export class LoginResultMapper {
  static toDto(
    account: LoginAccountRecord,
    sessionId: string,
    tokens: IssuedAuthTokens,
  ): LoginResultDto {
    return {
      sessionId,

      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,

      tokenType: 'Bearer',

      accessTokenExpiresInSeconds: tokens.accessTokenExpiresInSeconds,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,

      user: {
        id: account.id,
        email: account.email,
        username: account.username,
        displayName: account.displayName,
        emailVerified: account.emailVerifiedAt !== null,
        roles: [...account.roles],
      },
    };
  }
}

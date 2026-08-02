export const AUTH_TOKEN_ISSUER_PORT = Symbol('AUTH_TOKEN_ISSUER_PORT');

export interface IssueAuthTokensInput {
  userId: string;
  sessionId: string;
  refreshTokenFamilyId: string;
  accessTokenVersion: number;
  refreshTokenVersion: number;
}

export interface IssuedAuthTokens {
  accessToken: string;
  refreshToken: string;

  accessTokenExpiresInSeconds: number;
  refreshTokenExpiresInSeconds: number;

  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export interface AuthTokenIssuerPort {
  issue(input: IssueAuthTokensInput): IssuedAuthTokens;
}

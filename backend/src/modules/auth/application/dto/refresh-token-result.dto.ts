export interface RefreshTokenResultDto {
  sessionId: string;

  accessToken: string;
  refreshToken: string;

  tokenType: 'Bearer';

  accessTokenExpiresInSeconds: number;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

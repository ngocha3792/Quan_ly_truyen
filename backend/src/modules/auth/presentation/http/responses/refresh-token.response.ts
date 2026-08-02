export interface RefreshTokenResponse {
  sessionId: string;

  accessToken: string;
  tokenType: 'Bearer';

  expiresIn: number;
  expiresAt: string;
}

export const REFRESH_TOKEN_VERIFIER_PORT = Symbol(
  'AUTH_REFRESH_TOKEN_VERIFIER_PORT',
);

export interface VerifiedRefreshToken {
  userId: string;
  sessionId: string;
  familyId: string;
  version: number;
}

export interface RefreshTokenVerifierPort {
  verify(token: string): VerifiedRefreshToken;
}

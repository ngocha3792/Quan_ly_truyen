export type ResetPasswordStatus =
  'idle' | 'validating' | 'ready' | 'submitting' | 'success' | 'expired' | 'invalid' | 'error';

export interface ResetPasswordConfig {
  readonly minimumLength: number;
  readonly maximumLength: number;
  readonly maximumBytes: number;
  readonly requireLowercase: boolean;
  readonly requireUppercase: boolean;
  readonly requireNumber: boolean;
  readonly requireSymbol: boolean;
  readonly tokenExpiresInMinutes: number;
}

export interface ResetPasswordTokenRequest {
  readonly token: string;
}

export interface ResetPasswordTokenValidation {
  /* Backend validate token không expose email, nên email là optional. */
  readonly email?: string;

  readonly expiresAt: string;

  readonly isValid: boolean;
}

export interface ResetPasswordRequest {
  readonly token: string;
  readonly newPassword: string;
}

export interface ResetPasswordResult {
  /*
   * Backend POST /auth/reset-password không trả email.
   */
  readonly email?: string;

  readonly changedAt: string;

  readonly sessionsRevoked: number;

  readonly message: string;
}

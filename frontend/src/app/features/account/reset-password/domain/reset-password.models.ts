export type ResetPasswordStatus =
  'idle' | 'validating' | 'ready' | 'submitting' | 'success' | 'expired' | 'invalid' | 'error';

export interface ResetPasswordConfig {
  readonly minimumLength: number;
  readonly maximumLength: number;
  readonly tokenExpiresInMinutes: number;
}

export interface ResetPasswordTokenRequest {
  readonly token: string;
}

export interface ResetPasswordTokenValidation {
  /*
   * Backend hiện chưa có endpoint validate
   * reset token và không expose email từ token,
   * nên email là optional.
   */
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

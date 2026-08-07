export type ForgotPasswordStatus = 'idle' | 'submitting' | 'success' | 'error';

export interface ForgotPasswordRequest {
  readonly email: string;
}

export interface ForgotPasswordResult {
  readonly email: string;
  readonly requestedAt: string;
  readonly expiresInMinutes: number;
  readonly message: string;
}

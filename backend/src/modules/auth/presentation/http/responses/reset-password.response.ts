export interface ResetPasswordResponse {
  passwordReset: true;

  sessionsRevoked: number;

  resetAt: string;
}

export interface ResetPasswordResultDto {
  passwordReset: true;

  sessionsRevoked: number;

  resetAt: Date;
}

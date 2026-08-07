export class RecoveryEmailPolicy {
  static readonly CODE_LENGTH = 6;

  static readonly TTL_MINUTES = 10;

  static readonly RESEND_COOLDOWN_SECONDS = 60;

  static readonly MAX_RESENDS = 5;

  static readonly MAX_VERIFICATION_ATTEMPTS = 5;

  static createExpiresAt(requestedAt: Date): Date {
    return new Date(requestedAt.getTime() + this.TTL_MINUTES * 60 * 1000);
  }

  static getResendRetryAfterSeconds(
    verificationSentAt: Date | null,
    now: Date,
  ): number {
    if (!verificationSentAt) {
      return 0;
    }

    const elapsedSeconds = Math.floor(
      (now.getTime() - verificationSentAt.getTime()) / 1000,
    );

    return Math.max(0, this.RESEND_COOLDOWN_SECONDS - elapsedSeconds);
  }
}

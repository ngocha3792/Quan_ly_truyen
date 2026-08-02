export class EmailVerificationPolicy {
  static readonly TTL_MINUTES = 30;

  static createExpiresAt(now = new Date()): Date {
    return new Date(
      now.getTime() + EmailVerificationPolicy.TTL_MINUTES * 60_000,
    );
  }
}

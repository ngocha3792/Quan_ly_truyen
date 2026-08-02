export class PasswordResetPolicy {
  static readonly TTL_MINUTES = 15;

  static createExpiresAt(now = new Date()): Date {
    return new Date(now.getTime() + PasswordResetPolicy.TTL_MINUTES * 60_000);
  }
}

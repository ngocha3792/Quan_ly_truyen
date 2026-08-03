export class EmailChangePolicy {
  static readonly TTL_MINUTES = 30;

  static createExpiresAt(now = new Date()): Date {
    return new Date(now.getTime() + EmailChangePolicy.TTL_MINUTES * 60_000);
  }
}

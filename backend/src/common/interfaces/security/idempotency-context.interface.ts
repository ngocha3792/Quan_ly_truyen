export interface IdempotencyContext {
  key: string;
  requestHash: string;

  userId?: string;
  route: string;

  expiresAt: Date;
}

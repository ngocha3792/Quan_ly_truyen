export const AUTHORIZATION_INVALIDATION_PORT = Symbol(
  'AUTHORIZATION_INVALIDATION_PORT',
);

export interface AuthorizationInvalidationPort {
  /**
   * Gọi khi authorization snapshot
   * của user có thể đã thay đổi.
   *
   * Caller không cần biết:
   *
   * - Redis
   * - memory cache
   * - cache key
   * - cache implementation
   */
  invalidateUser(userId: string): Promise<void>;
}

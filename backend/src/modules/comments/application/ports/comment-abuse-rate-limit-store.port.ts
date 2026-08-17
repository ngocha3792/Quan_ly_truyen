export interface CommentAbuseRateLimitStorePort {
  readonly available: boolean;
  consume(
    key: string,
    windowSeconds: number,
  ): Promise<{ readonly count: number; readonly ttlSeconds: number }>;
}

export const COMMENT_ABUSE_RATE_LIMIT_STORE_PORT = Symbol(
  'COMMENT_ABUSE_RATE_LIMIT_STORE_PORT',
);

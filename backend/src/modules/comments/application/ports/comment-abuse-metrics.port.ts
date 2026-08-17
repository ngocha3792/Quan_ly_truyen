export type CommentAbuseMetricScope = 'comment' | 'reaction' | 'report';

export interface CommentAbuseMetricsPort {
  recordBlock(scope: CommentAbuseMetricScope): void;
}

export const COMMENT_ABUSE_METRICS_PORT = Symbol('COMMENT_ABUSE_METRICS_PORT');

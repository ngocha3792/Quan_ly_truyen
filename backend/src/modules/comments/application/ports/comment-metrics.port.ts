export const COMMENT_METRICS_PORT = Symbol('COMMENT_METRICS_PORT');

export interface CommentMetricsPort {
  recordOperation(operation: 'create' | 'update' | 'delete'): void;
}

import type { CommentModerationOperation } from '../../domain';

export type ModerationMetricOperation = CommentModerationOperation | 'warn' | 'ban';

export interface ModerationMetricsPort {
  record(operation: ModerationMetricOperation): void;
}

export const MODERATION_METRICS_PORT = Symbol('MODERATION_METRICS_PORT');

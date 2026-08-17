import { Injectable } from '@nestjs/common';
import { MetricsService } from '@/infrastructure/observability';
import type {
  ModerationMetricOperation,
  ModerationMetricsPort,
} from '../../application';

@Injectable()
export class MetricsModerationAdapter implements ModerationMetricsPort {
  constructor(private readonly metrics: MetricsService) {}

  record(operation: ModerationMetricOperation): void {
    this.metrics.recordCommentModeration(operation);
  }
}

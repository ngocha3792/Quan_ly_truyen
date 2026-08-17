import { Injectable } from '@nestjs/common';
import { MetricsService } from '@/infrastructure/observability';
import type {
  CommentAbuseMetricScope,
  CommentAbuseMetricsPort,
} from '../../application';

@Injectable()
export class MetricsCommentAbuseAdapter implements CommentAbuseMetricsPort {
  constructor(private readonly metrics: MetricsService) {}

  recordBlock(scope: CommentAbuseMetricScope): void {
    this.metrics.recordCommentAbuseBlock(scope);
  }
}

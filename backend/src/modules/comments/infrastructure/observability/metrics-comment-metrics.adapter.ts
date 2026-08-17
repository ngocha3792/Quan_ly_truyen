import { Injectable } from '@nestjs/common';
import { MetricsService } from '@/infrastructure/observability';
import type { CommentMetricsPort } from '../../application';

@Injectable()
export class MetricsCommentMetricsAdapter implements CommentMetricsPort {
  constructor(private readonly metrics: MetricsService) {}

  recordOperation(operation: 'create' | 'update' | 'delete'): void {
    this.metrics.recordCommentOperation(operation);
  }
}

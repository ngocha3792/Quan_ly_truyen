import { Injectable } from '@nestjs/common';
import { MetricsService } from '@/infrastructure/observability';
import type { AuditLogMetricsPort } from '../../application';

@Injectable()
export class MetricsAuditLogAdapter implements AuditLogMetricsPort {
  constructor(private readonly metrics: MetricsService) {}

  recordRead(
    operation: 'list' | 'detail',
    outcome: 'success' | 'error',
  ): void {
    this.metrics.recordAuditLogRead(operation, outcome);
  }
}

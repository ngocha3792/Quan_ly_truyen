import { Inject, Injectable } from '@nestjs/common';
import { AuditInvalidDateRangeException } from '../../../domain';
import type { AdminAuditLogListResult } from '../../dto';
import {
  AUDIT_LOG_METRICS_PORT,
  AUDIT_LOG_REPOSITORY_PORT,
  type AuditLogMetricsPort,
  type AuditLogRepositoryPort,
} from '../../ports';
import { ListAuditLogsQuery } from './list-audit-logs.query';
@Injectable()
export class ListAuditLogsQueryHandler {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY_PORT)
    private readonly repository: AuditLogRepositoryPort,
    @Inject(AUDIT_LOG_METRICS_PORT)
    private readonly metrics: AuditLogMetricsPort,
  ) {}
  async execute(query: ListAuditLogsQuery): Promise<AdminAuditLogListResult> {
    const input = query.input;
    try {
      if (input.from && input.to && input.from > input.to)
        throw new AuditInvalidDateRangeException();
      const result = await this.repository.list(input);
      this.metrics.recordRead('list', 'success');
      return {
        items: result.items,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalItems: result.totalItems,
          totalPages: Math.ceil(result.totalItems / input.pageSize),
        },
      };
    } catch (error) {
      this.metrics.recordRead('list', 'error');
      throw error;
    }
  }
}

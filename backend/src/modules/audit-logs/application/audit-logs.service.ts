import { Inject, Injectable } from '@nestjs/common';
import {
  AuditInvalidDateRangeException,
  AuditLogNotFoundException,
  diffSanitizedAuditValues,
  maskAuditIpAddress,
  sanitizeAuditPayload,
  sanitizeAuditUserAgent,
} from '../domain';
import type {
  AdminAuditLogDetail,
  AdminAuditLogListResult,
  ListAuditLogsInput,
} from './audit-log.models';
import {
  AUDIT_LOG_METRICS_PORT,
  AUDIT_LOG_REPOSITORY_PORT,
  type AuditLogMetricsPort,
  type AuditLogRepositoryPort,
} from './ports';

@Injectable()
export class AuditLogsService {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY_PORT)
    private readonly repository: AuditLogRepositoryPort,
    @Inject(AUDIT_LOG_METRICS_PORT)
    private readonly metrics: AuditLogMetricsPort,
  ) {}

  async list(input: ListAuditLogsInput): Promise<AdminAuditLogListResult> {
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

  async detail(id: string): Promise<AdminAuditLogDetail> {
    try {
      const record = await this.repository.findById(id);
      if (!record) throw new AuditLogNotFoundException(id);

      const oldValues = sanitizeAuditPayload(record.oldValues);
      const newValues = sanitizeAuditPayload(record.newValues);
      const metadata = sanitizeAuditPayload(record.metadata);
      const result: AdminAuditLogDetail = {
        id: record.id,
        actorId: record.actorId,
        actor: record.actor,
        action: record.action,
        entity: { type: record.entityType, id: record.entityId },
        requestId: record.requestId,
        createdAt: record.createdAt,
        client: {
          ipAddress: maskAuditIpAddress(record.ipAddress),
          userAgent: sanitizeAuditUserAgent(record.userAgent),
        },
        oldValues,
        newValues,
        metadata,
        changes: diffSanitizedAuditValues(oldValues, newValues),
      };
      this.metrics.recordRead('detail', 'success');
      return result;
    } catch (error) {
      this.metrics.recordRead('detail', 'error');
      throw error;
    }
  }
}

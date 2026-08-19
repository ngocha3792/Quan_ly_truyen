import { Inject, Injectable } from '@nestjs/common';
import {
  AuditLogNotFoundException,
  diffSanitizedAuditValues,
  maskAuditIpAddress,
  sanitizeAuditPayload,
  sanitizeAuditUserAgent,
} from '../../../domain';
import type { AdminAuditLogDetail } from '../../dto';
import {
  AUDIT_LOG_METRICS_PORT,
  AUDIT_LOG_REPOSITORY_PORT,
  type AuditLogMetricsPort,
  type AuditLogRepositoryPort,
} from '../../ports';
import { GetAuditLogDetailQuery } from './get-audit-log-detail.query';
@Injectable()
export class GetAuditLogDetailQueryHandler {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY_PORT)
    private readonly repository: AuditLogRepositoryPort,
    @Inject(AUDIT_LOG_METRICS_PORT)
    private readonly metrics: AuditLogMetricsPort,
  ) {}
  async execute(query: GetAuditLogDetailQuery): Promise<AdminAuditLogDetail> {
    try {
      const record = await this.repository.findById(query.id);
      if (!record) throw new AuditLogNotFoundException(query.id);
      const oldValues = sanitizeAuditPayload(record.oldValues),
        newValues = sanitizeAuditPayload(record.newValues),
        metadata = sanitizeAuditPayload(record.metadata);
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

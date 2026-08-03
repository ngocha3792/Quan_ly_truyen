import type { AuthAuditRecord } from '../ports';

import type { SecurityEventResultDto } from '../dto';

export class SecurityEventResultMapper {
  static toDto(record: AuthAuditRecord): SecurityEventResultDto {
    return {
      id: record.id,

      action: record.action,

      entityType: record.entityType,

      entityId: record.entityId,

      metadata: record.metadata,

      ipAddress: record.ipAddress,

      userAgent: record.userAgent,

      requestId: record.requestId,

      createdAt: record.createdAt,
    };
  }
}

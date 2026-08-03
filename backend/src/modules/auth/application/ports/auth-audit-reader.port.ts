export const AUTH_AUDIT_READER_PORT = Symbol('AUTH_AUDIT_READER_PORT');

export interface AuthAuditRecord {
  id: string;

  action: string;

  entityType: string;

  entityId: string | null;

  metadata: Record<string, unknown> | null;

  ipAddress: string | null;

  userAgent: string | null;

  requestId: string | null;

  createdAt: Date;
}

export interface AuthAuditReaderPort {
  listByUserId(
    userId: string,

    limit: number,
  ): Promise<readonly AuthAuditRecord[]>;
}

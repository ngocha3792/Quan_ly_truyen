import type { ListAuditLogsInput } from '../dto';

export interface AuditLogListRecord {
  readonly id: string;
  readonly actorId: string | null;
  readonly actor: { readonly id: string; readonly displayName: string } | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly requestId: string | null;
  readonly createdAt: Date;
}

export interface AuditLogDetailRecord extends AuditLogListRecord {
  readonly oldValues: unknown;
  readonly newValues: unknown;
  readonly metadata: unknown;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly actor: {
    readonly id: string;
    readonly displayName: string;
    readonly email: string;
  } | null;
}

export interface AuditLogRepositoryPort {
  list(input: ListAuditLogsInput): Promise<{
    readonly items: readonly AuditLogListRecord[];
    readonly totalItems: number;
  }>;
  findById(id: string): Promise<AuditLogDetailRecord | null>;
}

export const AUDIT_LOG_REPOSITORY_PORT = Symbol('AUDIT_LOG_REPOSITORY_PORT');

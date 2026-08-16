import type { AuditChange, SafeAuditValue } from '../domain';

export interface ListAuditLogsInput {
  readonly actorId?: string;
  readonly action?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly requestId?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly page: number;
  readonly pageSize: number;
}

export interface AdminAuditLogListItem {
  readonly id: string;
  readonly actorId: string | null;
  readonly actor: { readonly id: string; readonly displayName: string } | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly requestId: string | null;
  readonly createdAt: Date;
}

export interface AdminAuditLogListResult {
  readonly items: readonly AdminAuditLogListItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

export interface AdminAuditLogDetail {
  readonly id: string;
  readonly actorId: string | null;
  readonly actor: { readonly id: string; readonly displayName: string; readonly email: string } | null;
  readonly action: string;
  readonly entity: { readonly type: string; readonly id: string | null };
  readonly requestId: string | null;
  readonly createdAt: Date;
  readonly client: { readonly ipAddress: string | null; readonly userAgent: string | null };
  readonly oldValues: SafeAuditValue;
  readonly newValues: SafeAuditValue;
  readonly metadata: SafeAuditValue;
  readonly changes: readonly AuditChange[];
}

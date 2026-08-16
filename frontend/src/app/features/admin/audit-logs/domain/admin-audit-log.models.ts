export type SafeAuditValue =
  | string
  | number
  | boolean
  | null
  | readonly SafeAuditValue[]
  | { readonly [key: string]: SafeAuditValue };

export interface AdminAuditLogListItem {
  readonly id: string;
  readonly actorId: string | null;
  readonly actor: { readonly id: string; readonly displayName: string } | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly requestId: string | null;
  readonly createdAt: string;
}

export interface AdminAuditLogList {
  readonly items: readonly AdminAuditLogListItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

export interface AdminAuditChange {
  readonly path: string;
  readonly type: 'added' | 'removed' | 'changed';
  readonly before: SafeAuditValue | null;
  readonly after: SafeAuditValue | null;
}

export interface AdminAuditLogDetail {
  readonly id: string;
  readonly actorId: string | null;
  readonly actor: { readonly id: string; readonly displayName: string; readonly email: string } | null;
  readonly action: string;
  readonly entity: { readonly type: string; readonly id: string | null };
  readonly requestId: string | null;
  readonly createdAt: string;
  readonly client: { readonly ipAddress: string | null; readonly userAgent: string | null };
  readonly oldValues: SafeAuditValue;
  readonly newValues: SafeAuditValue;
  readonly metadata: SafeAuditValue;
  readonly changes: readonly AdminAuditChange[];
}

export interface AdminAuditLogFilters {
  readonly actorId?: string;
  readonly action?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly requestId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

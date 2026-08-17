export type ReportCloseStatus = 'RESOLVED' | 'REJECTED';

export interface AdminReportListQuery {
  readonly status?: string;
  readonly reason?: string;
  readonly reporter?: string;
  readonly reportedUser?: string;
  readonly createdFrom?: Date;
  readonly createdTo?: Date;
  readonly page: number;
  readonly pageSize: number;
  readonly sort?: 'createdAt' | 'status' | 'reason';
  readonly direction?: 'asc' | 'desc';
}

export interface ReportAuditContext {
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
}

export interface CloseReportPersistenceInput {
  readonly actorId: string;
  readonly reportId: string;
  readonly note: string;
  readonly status: ReportCloseStatus;
  readonly auditAction: string;
  readonly audit: ReportAuditContext;
}

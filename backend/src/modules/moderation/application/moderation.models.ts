export type CommentModerationOperation = 'hold' | 'hide' | 'restore' | 'remove';

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

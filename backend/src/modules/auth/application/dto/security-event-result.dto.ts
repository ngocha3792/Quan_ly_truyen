export interface SecurityEventResultDto {
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

export interface GetSecurityEventsResultDto {
  events: readonly SecurityEventResultDto[];

  total: number;
}

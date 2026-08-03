export interface SecurityEventResponse {
  id: string;

  action: string;

  entityType: string;

  entityId: string | null;

  metadata: Record<string, unknown> | null;

  ipAddress: string | null;

  userAgent: string | null;

  requestId: string | null;

  createdAt: string;
}

export interface SecurityEventsResponse {
  events: readonly SecurityEventResponse[];

  total: number;
}

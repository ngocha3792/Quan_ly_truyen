export interface SessionResponse {
  id: string;
  isCurrent: boolean;

  deviceId: string | null;
  deviceName: string | null;

  ipAddress: string | null;
  userAgent: string | null;

  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string;
  trusted: boolean;
}

export interface SessionsResponse {
  sessions: readonly SessionResponse[];

  total: number;
}

export interface RevokeOtherSessionsResponse {
  revokedCount: number;
}

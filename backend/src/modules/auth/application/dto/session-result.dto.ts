export interface SessionResultDto {
  id: string;
  isCurrent: boolean;

  deviceId: string | null;
  deviceName: string | null;

  ipAddress: string | null;
  userAgent: string | null;

  lastUsedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
  trusted: boolean;
}

export interface GetSessionsResultDto {
  sessions: readonly SessionResultDto[];
  total: number;
}

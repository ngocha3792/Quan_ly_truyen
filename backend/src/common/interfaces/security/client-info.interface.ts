export interface ClientInfo {
  ipAddress?: string;
  userAgent?: string;

  deviceId?: string;
  deviceName?: string;

  platform?: string;
  browser?: string;
}
export interface SessionContext {
  sessionId: string;
  userId: string;

  client: ClientInfo;

  createdAt: Date;
  expiresAt: Date;
}

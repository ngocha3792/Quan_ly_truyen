export interface AdminSessionView {
  sessionId: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  expiresAt: Date;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  revoked: boolean;
  revokedAt: Date | null;
  revokedReason: string | null;
}

export interface AdminSecurityEventView {
  id: string;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: Date;
}

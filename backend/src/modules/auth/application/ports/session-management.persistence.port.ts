export const SESSION_MANAGEMENT_PERSISTENCE_PORT = Symbol(
  'AUTH_SESSION_MANAGEMENT_PERSISTENCE_PORT',
);

export interface ManagedSessionRecord {
  id: string;

  deviceId: string | null;
  deviceName: string | null;

  ipAddress: string | null;
  userAgent: string | null;

  lastUsedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
}

export interface RevokeUserSessionInput {
  userId: string;
  sessionId: string;

  revokedAt: Date;
  reason: string;
}

export interface SessionManagementPersistencePort {
  listActiveByUserId(
    userId: string,
    now: Date,
  ): Promise<readonly ManagedSessionRecord[]>;

  /**
   * Chỉ revoke khi session thuộc đúng user.
   *
   * Trả về false nếu session không tồn tại,
   * đã bị revoke hoặc thuộc user khác.
   */
  revokeUserSession(input: RevokeUserSessionInput): Promise<boolean>;
}

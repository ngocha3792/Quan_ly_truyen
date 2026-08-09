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

  /**
   * Session đang thực hiện request revoke.
   */
  actorSessionId: string;

  /**
   * Session cần revoke.
   */
  sessionId: string;

  revokedAt: Date;

  reason: string;
}

export interface RevokeOtherUserSessionsInput {
  userId: string;

  /**
   * Session hiện tại phải được giữ lại.
   */
  actorSessionId: string;

  revokedAt: Date;

  reason: string;
}

export interface SessionManagementPersistencePort {
  listActiveByUserId(
    userId: string,

    now: Date,
  ): Promise<readonly ManagedSessionRecord[]>;

  revokeUserSession(input: RevokeUserSessionInput): Promise<boolean>;

  revokeOtherUserSessions(input: RevokeOtherUserSessionsInput): Promise<number>;
}

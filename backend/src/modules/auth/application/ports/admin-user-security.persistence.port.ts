export interface AdminUserSecuritySessionRecord {
  readonly sessionId: string;
  readonly createdAt: Date;
  readonly lastSeenAt: Date | null;
  readonly expiresAt: Date;
  readonly deviceName: string | null;
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
  readonly revoked: boolean;
  readonly revokedAt: Date | null;
  readonly revokedReason: string | null;
}

export interface AdminUserSecurityEventRecord {
  readonly id: string;
  readonly action: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly requestId: string | null;
  readonly createdAt: Date;
}

export interface AdminUnlockIdentityRecord {
  readonly email: string;
  readonly username: string;
  readonly status: string;
}

export interface AdminUserSecurityPersistencePort {
  userExists(userId: string): Promise<boolean>;

  listSessions(
    userId: string,
  ): Promise<readonly AdminUserSecuritySessionRecord[]>;

  revokeSession(input: {
    readonly actorUserId: string;
    readonly userId: string;
    readonly sessionId: string;
    readonly revokedAt: Date;
  }): Promise<'revoked' | 'already_revoked' | 'not_found'>;

  revokeAllSessions(input: {
    readonly actorUserId: string;
    readonly userId: string;
    readonly revokedAt: Date;
  }): Promise<number>;

  findUnlockIdentity(userId: string): Promise<AdminUnlockIdentityRecord | null>;

  writeUnlockAuditBestEffort(input: {
    readonly actorUserId: string;
    readonly userId: string;
    readonly accountStatus: string;
  }): Promise<void>;

  listSecurityEvents(input: {
    readonly userId: string;
    readonly actions: readonly string[];
  }): Promise<readonly AdminUserSecurityEventRecord[]>;
}

export const ADMIN_USER_SECURITY_PERSISTENCE_PORT = Symbol(
  'ADMIN_USER_SECURITY_PERSISTENCE_PORT',
);

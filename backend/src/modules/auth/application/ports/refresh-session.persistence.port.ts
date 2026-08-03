import type { AuthAccountStatus } from '../../domain/enums';

export const REFRESH_SESSION_PERSISTENCE_PORT = Symbol(
  'AUTH_REFRESH_SESSION_PERSISTENCE_PORT',
);

export interface RefreshSessionSnapshot {
  sessionId: string;
  userId: string;

  refreshTokenHash: string;
  refreshTokenFamilyId: string;
  refreshTokenVersion: number;
  accessTokenVersion: number;

  expiresAt: Date;
  revokedAt: Date | null;

  accountStatus: AuthAccountStatus;
  userDeletedAt: Date | null;
}

export interface RotateRefreshSessionInput {
  sessionId: string;
  userId: string;
  familyId: string;

  expectedRefreshTokenHash: string;
  expectedRefreshTokenVersion: number;

  nextRefreshTokenHash: string;
  nextRefreshTokenVersion: number;

  rotatedAt: Date;

  ipAddress?: string;
  userAgent?: string;
}

export interface RevokeRefreshTokenFamilyInput {
  userId: string;

  sessionId: string;

  familyId: string;

  revokedAt: Date;

  reason: string;
}

export interface RevokeAllUserSessionsInput {
  userId: string;

  actorSessionId?: string;

  revokedAt: Date;

  reason: string;
}
export interface RevokeCurrentSessionInput {
  sessionId: string;
  userId: string;
  familyId: string;

  revokedAt: Date;
  reason: string;
}

export interface RefreshSessionPersistencePort {
  findBySessionId(sessionId: string): Promise<RefreshSessionSnapshot | null>;

  rotate(input: RotateRefreshSessionInput): Promise<boolean>;

  revokeFamily(input: RevokeRefreshTokenFamilyInput): Promise<void>;

  revokeCurrentSession(input: RevokeCurrentSessionInput): Promise<void>;

  /**
   * Revoke toàn bộ session chưa bị thu hồi của một user.
   *
   * Trả về số session đã được cập nhật.
   */
  revokeAllUserSessions(input: RevokeAllUserSessionsInput): Promise<number>;
}

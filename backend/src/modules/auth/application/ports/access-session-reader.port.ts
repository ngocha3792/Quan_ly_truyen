import type { PermissionCode, RoleCode } from '@/common/enums';

import type { AuthAccountStatus } from '../../domain/enums';

export const ACCESS_SESSION_READER_PORT = Symbol(
  'AUTH_ACCESS_SESSION_READER_PORT',
);

export interface AccessSessionSnapshot {
  sessionId: string;
  userId: string;

  accessTokenVersion: number;
  expiresAt: Date;
  revokedAt: Date | null;
  mfaVerifiedAt?: Date | null;

  email: string;
  emailVerifiedAt: Date | null;
  accountStatus: AuthAccountStatus;
  userDeletedAt: Date | null;

  roles: readonly RoleCode[];
  permissions: readonly PermissionCode[];

  authorProfileId?: string;
}

export interface AccessSessionReaderPort {
  findBySessionId(sessionId: string): Promise<AccessSessionSnapshot | null>;
}

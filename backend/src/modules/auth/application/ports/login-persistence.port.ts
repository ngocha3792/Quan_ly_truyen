import type { RoleCode } from '@/common/enums';

import type { AuthAccountStatus } from '../../domain/enums';

export const LOGIN_PERSISTENCE_PORT = Symbol('AUTH_LOGIN_PERSISTENCE_PORT');

export interface LoginAccountRecord {
  id: string;
  email: string;
  username: string;
  displayName: string;
  passwordHash: string | null;

  status: AuthAccountStatus;
  deletedAt: Date | null;
  emailVerifiedAt: Date | null;

  roles: readonly RoleCode[];
  mfaEnabled?: boolean;
}

export interface CreateLoginSessionInput {
  id: string;
  userId: string;

  refreshTokenHash: string;
  refreshTokenFamilyId: string;
  refreshTokenVersion: number;
  accessTokenVersion: number;
  mfaVerifiedAt?: Date;
  authenticationMethod?: 'password' | 'google' | 'github';

  deviceId?: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;

  loggedInAt: Date;
  expiresAt: Date;
}

export interface LoginPersistencePort {
  findAccountByIdentifier(
    identifier: string,
  ): Promise<LoginAccountRecord | null>;

  createSession(input: CreateLoginSessionInput): Promise<void>;
}

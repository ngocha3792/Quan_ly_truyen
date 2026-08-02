import type { PermissionCode, RoleCode } from '@/common/enums';

import type { AuthAccountStatus } from '../../domain/enums';

export const CURRENT_USER_READER_PORT = Symbol('AUTH_CURRENT_USER_READER_PORT');

export type AuthAuthorVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface CurrentUserAvatarRecord {
  id: string;
  url: string | null;
}

export interface CurrentUserAuthorProfileRecord {
  id: string;
  penName: string;
  verificationStatus: AuthAuthorVerificationStatus;
}

export interface CurrentUserRecord {
  id: string;

  email: string;
  username: string;
  displayName: string;
  bio: string | null;

  status: AuthAccountStatus;

  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;

  avatar: CurrentUserAvatarRecord | null;

  authorProfile: CurrentUserAuthorProfileRecord | null;

  roles: readonly RoleCode[];
  permissions: readonly PermissionCode[];

  createdAt: Date;
  updatedAt: Date;
}

export interface CurrentUserReaderPort {
  findById(userId: string): Promise<CurrentUserRecord | null>;
}

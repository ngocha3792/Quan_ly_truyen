import type { PermissionCode, RoleCode } from '@/common/enums';

import type { AuthAccountStatus } from '../../../domain/enums';
import type { AuthAuthorVerificationStatus } from '../../../application/ports';

export interface CurrentUserResponse {
  id: string;
  sessionId: string;

  email: string;
  username: string;
  displayName: string;
  bio: string | null;

  status: AuthAccountStatus;

  emailVerified: boolean;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;

  avatar: {
    id: string;
    url: string | null;
  } | null;

  authorProfile: {
    id: string;
    penName: string;
    verificationStatus: AuthAuthorVerificationStatus;
  } | null;

  roles: readonly RoleCode[];

  permissions: readonly PermissionCode[];

  createdAt: string;
  updatedAt: string;
}

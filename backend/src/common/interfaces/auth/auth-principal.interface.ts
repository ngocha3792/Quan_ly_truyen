import type { PermissionCode, RoleCode } from '@/common/enums';

export interface AuthPrincipal {
  userId: string;
  sessionId: string;
  email?: string;
  emailVerified: boolean;
  roles: readonly RoleCode[];
  permissions: readonly PermissionCode[];
  authorProfileId?: string;
}
import type { PermissionCode, RoleCode } from '@/common/enums';

export interface AuthPrincipal {
  userId: string;
  sessionId: string;

  email?: string;
  emailVerified: boolean;

  roles: readonly RoleCode[];
  permissions: readonly PermissionCode[];

  authorProfileId?: string;
  mfaVerified?: boolean;

  /**
   * JTI của access token hiện tại.
   */
  tokenId?: string;

  /**
   * Thời gian access token hiện tại hết hạn.
   */
  tokenExpiresAt?: Date;
}

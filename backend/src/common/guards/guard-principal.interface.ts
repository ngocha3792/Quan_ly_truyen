import type { PermissionCode, RoleCode } from '../enums';

/**
 * Minimal authenticated-principal shape consumed by common guards.
 * The JWT strategy may attach additional properties without affecting guards.
 */
export interface GuardPrincipal {
  userId?: string;
  sub?: string;
  sessionId?: string;
  sid?: string;

  roles?: readonly (RoleCode | string)[];
  permissions?: readonly (PermissionCode | string)[];

  emailVerified?: boolean;
  emailVerifiedAt?: Date | string | null;
}

export interface GuardHttpRequest {
  user?: GuardPrincipal;
  headers?: Readonly<Record<string, string | readonly string[] | undefined>>;
}

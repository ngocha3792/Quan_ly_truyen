import { SetMetadata } from '@nestjs/common';

import { PERMISSIONS_KEY } from '@/common/constants';
import { PermissionCode } from '@/common/enums';

/**
 * Declares permissions required by a route. PermissionsGuard should require
 * every permission in the list unless the application explicitly implements
 * another policy.
 */
export const RequirePermissions = (
  ...permissions: readonly PermissionCode[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Backward-compatible shorter name. */
export const Permissions = RequirePermissions;

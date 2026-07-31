import { SetMetadata } from '@nestjs/common';

import { ROLES_KEY } from '@/common/constants';
import { RoleCode } from '@/common/enums';

/**
 * Declares roles accepted by a route. RolesGuard normally treats the list as
 * an OR condition: having any listed role is sufficient.
 */
export const Roles = (
  ...roles: readonly RoleCode[]
): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);

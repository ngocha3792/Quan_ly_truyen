import { PermissionCode } from '@/common/enums';
import { AuthPrincipal } from './auth-principal.interface';

export interface PermissionCheck {
    principal: AuthPrincipal;
    requiredPermissions: readonly PermissionCode[];
    requireAll?: boolean;
}
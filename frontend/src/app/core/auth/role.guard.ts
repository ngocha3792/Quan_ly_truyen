import { inject } from '@angular/core';

import { CanActivateFn, Router } from '@angular/router';

import { map } from 'rxjs';

import { AuthRole } from './authorization.models';

import {
  createAccessDeniedUrlTree,
  createLoginRequiredUrlTree,
  resolveAuthenticatedUser,
} from './auth-guard.util';

import { AuthStore } from './auth.store';

/**
 * Kiểm tra role theo cơ chế ANY-OF.
 *
 * Ví dụ:
 *
 * roleGuard(
 *   AUTH_ROLES.AUTHOR,
 *   AUTH_ROLES.ADMIN,
 * )
 *
 * → chỉ cần có AUTHOR hoặc ADMIN.
 */
export function roleGuard(
  requiredRole: AuthRole,
  ...additionalRoles: readonly AuthRole[]
): CanActivateFn {
  const requiredRoles = [requiredRole, ...additionalRoles];

  return (_route, state) => {
    const auth = inject(AuthStore);

    const router = inject(Router);

    return resolveAuthenticatedUser(auth).pipe(
      map((user) => {
        /**
         * Guard này vẫn tự xử lý anonymous.
         *
         * Không phụ thuộc việc
         * authenticatedGuard có chạy trước
         * hay không.
         */
        if (!user) {
          return createLoginRequiredUrlTree(router, state);
        }

        const userRoles = new Set(user.roles.map(normalizeRole));

        const hasRequiredRole = requiredRoles.some((role) => userRoles.has(normalizeRole(role)));

        if (hasRequiredRole) {
          return true;
        }

        return createAccessDeniedUrlTree(router, state, 'role');
      }),
    );
  };
}

function normalizeRole(role: string): string {
  return role.trim().toUpperCase();
}

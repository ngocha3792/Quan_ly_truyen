import { inject } from '@angular/core';

import { CanActivateFn, Router } from '@angular/router';

import { map } from 'rxjs';

import { AuthPermission } from './authorization.models';

import {
  createAccessDeniedUrlTree,
  createLoginRequiredUrlTree,
  resolveAuthenticatedUser,
} from './auth-guard.util';

import { AuthStore } from './auth.store';

/**
 * Permission guard sử dụng ALL-OF.
 *
 * Ví dụ:
 *
 * permissionGuard(
 *   STORY_CREATE,
 *   CHAPTER_CREATE,
 * )
 *
 * User phải có cả hai permission.
 *
 * Hiện tại các route của Stage 3
 * chỉ yêu cầu một permission.
 */
export function permissionGuard(
  requiredPermission: AuthPermission,

  ...additionalPermissions: readonly AuthPermission[]
): CanActivateFn {
  const requiredPermissions = [requiredPermission, ...additionalPermissions];

  return (_route, state) => {
    const auth = inject(AuthStore);

    const router = inject(Router);

    return resolveAuthenticatedUser(auth).pipe(
      map((user) => {
        if (!user) {
          return createLoginRequiredUrlTree(router, state);
        }

        const userPermissions = new Set(user.permissions.map(normalizePermission));

        const hasAllPermissions = requiredPermissions.every((permission) =>
          userPermissions.has(normalizePermission(permission)),
        );

        if (hasAllPermissions) {
          return true;
        }

        return createAccessDeniedUrlTree(router, state, 'permission');
      }),
    );
  };
}

function normalizePermission(permission: string): string {
  return permission.trim().toLowerCase();
}

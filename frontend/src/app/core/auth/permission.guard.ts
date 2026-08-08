import { inject } from '@angular/core';

import { CanActivateFn, Router } from '@angular/router';

import { catchError, map, of, switchMap } from 'rxjs';

import { AuthAuthorizationSyncService } from './auth-authorization-sync.service';

import {
  createAccessDeniedUrlTree,
  createLoginRequiredUrlTree,
  resolveAuthenticatedUser,
} from './auth-guard.util';

import { AuthPermission } from './authorization.models';

import { CurrentUser } from './auth.models';

import { AuthStore } from './auth.store';

export function permissionGuard(
  requiredPermission: AuthPermission,

  ...additionalPermissions: readonly AuthPermission[]
): CanActivateFn {
  const requiredPermissions = [requiredPermission, ...additionalPermissions];

  return (
    _route,

    state,
  ) => {
    const auth = inject(AuthStore);

    const authorizationSync = inject(AuthAuthorizationSyncService);

    const router = inject(Router);

    return resolveAuthenticatedUser(auth).pipe(
      switchMap((user) => {
        if (!user) {
          return of(
            createLoginRequiredUrlTree(
              router,

              state,
            ),
          );
        }

        if (
          hasAllPermissions(
            user,

            requiredPermissions,
          )
        ) {
          return of(true);
        }

        /*
         * Giống roleGuard:
         *
         * thiếu permission local chưa chắc
         * backend authorization hiện tại
         * thật sự thiếu.
         */
        return authorizationSync.revalidateCurrentUser().pipe(
          map((freshUser) => {
            if (!freshUser) {
              return createLoginRequiredUrlTree(
                router,

                state,
              );
            }

            if (
              hasAllPermissions(
                freshUser,

                requiredPermissions,
              )
            ) {
              return true;
            }

            return createAccessDeniedUrlTree(
              router,

              state,

              'permission',
            );
          }),

          catchError(() => {
            if (auth.status() === 'anonymous') {
              return of(
                createLoginRequiredUrlTree(
                  router,

                  state,
                ),
              );
            }

            return of(
              createAccessDeniedUrlTree(
                router,

                state,

                'permission',
              ),
            );
          }),
        );
      }),
    );
  };
}

function hasAllPermissions(
  user: CurrentUser,

  requiredPermissions: readonly AuthPermission[],
): boolean {
  const userPermissions = new Set(user.permissions.map(normalizePermission));

  return requiredPermissions.every((permission) =>
    userPermissions.has(normalizePermission(permission)),
  );
}

function normalizePermission(permission: string): string {
  return permission.trim().toLowerCase();
}

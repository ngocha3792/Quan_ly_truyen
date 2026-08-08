import { inject } from '@angular/core';

import { CanActivateFn, Router } from '@angular/router';

import { catchError, map, of, switchMap } from 'rxjs';

import { AuthAuthorizationSyncService } from './auth-authorization-sync.service';

import {
  createAccessDeniedUrlTree,
  createLoginRequiredUrlTree,
  resolveAuthenticatedUser,
} from './auth-guard.util';

import { AuthRole } from './authorization.models';

import { CurrentUser } from './auth.models';

import { AuthStore } from './auth.store';

export function roleGuard(
  requiredRole: AuthRole,

  ...additionalRoles: readonly AuthRole[]
): CanActivateFn {
  const requiredRoles = [requiredRole, ...additionalRoles];

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

        /*
         * Fast path:
         * local authorization đã đủ.
         */
        if (
          hasAnyRequiredRole(
            user,

            requiredRoles,
          )
        ) {
          return of(true);
        }

        /*
         * Local state thiếu role.
         *
         * Trước khi kết luận 403 UI,
         * revalidate /auth/me đúng một lần.
         *
         * Đây giải quyết:
         *
         * USER
         * → admin approve
         * → AUTHOR
         *
         * nhưng frontend vẫn giữ USER cũ.
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
              hasAnyRequiredRole(
                freshUser,

                requiredRoles,
              )
            ) {
              return true;
            }

            return createAccessDeniedUrlTree(
              router,

              state,

              'role',
            );
          }),

          catchError(() => {
            /*
             * Nếu sync làm session bị invalidate,
             * Stage 2 AuthStore đã chuyển anonymous.
             */
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

                'role',
              ),
            );
          }),
        );
      }),
    );
  };
}

function hasAnyRequiredRole(
  user: CurrentUser,

  requiredRoles: readonly AuthRole[],
): boolean {
  const userRoles = new Set(user.roles.map(normalizeRole));

  return requiredRoles.some((role) => userRoles.has(normalizeRole(role)));
}

function normalizeRole(role: string): string {
  return role.trim().toUpperCase();
}

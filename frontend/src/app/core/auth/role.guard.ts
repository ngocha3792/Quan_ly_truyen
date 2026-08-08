import { inject } from '@angular/core';

import { CanActivateFn, Router } from '@angular/router';

import { catchError, map, of, switchMap } from 'rxjs';

import { AuthAuthorizationSyncService } from './auth-authorization-sync.service';

import {
  createAccessDeniedUrlTree,
  createAuthTemporarilyUnavailableUrlTree,
  createLoginRequiredUrlTree,
  resolveAuthGuardState,
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

    return resolveAuthGuardState(auth).pipe(
      switchMap((resolution) => {
        if (resolution.kind === 'unavailable') {
          return of(
            createAuthTemporarilyUnavailableUrlTree(
              router,

              state,
            ),
          );
        }

        if (resolution.kind === 'anonymous') {
          return of(
            createLoginRequiredUrlTree(
              router,

              state,
            ),
          );
        }

        const user = resolution.user;

        /**
         * Fast path.
         */
        if (
          hasAnyRequiredRole(
            user,

            requiredRoles,
          )
        ) {
          return of(true);
        }

        /**
         * Local role có thể stale.
         *
         * Revalidate /auth/me trước khi kết luận
         * user thật sự thiếu role.
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
            /**
             * Nếu interceptor cố refresh và gặp
             * network/5xx thì AuthStore sẽ về idle.
             *
             * Không biến case đó thành 403.
             */
            if (auth.status() === 'idle') {
              return of(
                createAuthTemporarilyUnavailableUrlTree(
                  router,

                  state,
                ),
              );
            }

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

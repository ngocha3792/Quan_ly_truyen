import { inject } from '@angular/core';

import { CanActivateFn, Router } from '@angular/router';

import { map } from 'rxjs';

import {
  createAuthTemporarilyUnavailableUrlTree,
  createLoginRequiredUrlTree,
  resolveAuthGuardState,
} from './auth-guard.util';

import { AuthStore } from './auth.store';

export const authenticatedGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthStore);

  const router = inject(Router);

  return resolveAuthGuardState(auth).pipe(
    map((resolution) => {
      if (resolution.kind === 'authenticated') {
        return true;
      }

      if (resolution.kind === 'unavailable') {
        return createAuthTemporarilyUnavailableUrlTree(
          router,

          state,
        );
      }

      return createLoginRequiredUrlTree(
        router,

        state,
      );
    }),
  );
};

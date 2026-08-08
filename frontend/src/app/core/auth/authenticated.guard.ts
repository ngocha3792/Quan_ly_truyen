import { inject } from '@angular/core';

import { CanActivateFn, Router } from '@angular/router';

import { map } from 'rxjs';

import { createLoginRequiredUrlTree, resolveAuthenticatedUser } from './auth-guard.util';

import { AuthStore } from './auth.store';

export const authenticatedGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthStore);

  const router = inject(Router);

  return resolveAuthenticatedUser(auth).pipe(
    map((user) => {
      if (user) {
        return true;
      }

      return createLoginRequiredUrlTree(router, state);
    }),
  );
};

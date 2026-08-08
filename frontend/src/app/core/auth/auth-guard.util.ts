import { Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { map, Observable, of } from 'rxjs';

import { CurrentUser } from './auth.models';

import { AuthBootstrapResult, AuthStore } from './auth.store';

export type AuthGuardResolution =
  | {
      readonly kind: 'authenticated';

      readonly user: CurrentUser;
    }
  | {
      readonly kind: 'anonymous';

      readonly user: null;
    }
  | {
      readonly kind: 'unavailable';

      readonly user: null;
    };

/**
 * Resolve auth bootstrap thành một terminal state cho guard.
 *
 * authenticated:
 *   session hợp lệ + có CurrentUser.
 *
 * anonymous:
 *   đã xác định không còn session hợp lệ.
 *
 * unavailable:
 *   chưa thể xác minh session do network / 5xx.
 *
 * Không còn filter AuthStatus idle/loading nữa.
 */
export function resolveAuthGuardState(auth: AuthStore): Observable<AuthGuardResolution> {
  const currentStatus = auth.status();

  if (currentStatus === 'authenticated') {
    const currentUser = auth.user();

    if (currentUser) {
      return of({
        kind: 'authenticated',

        user: currentUser,
      });
    }
  }

  if (currentStatus === 'anonymous') {
    return of({
      kind: 'anonymous',

      user: null,
    });
  }

  return auth.ensureInitialized().pipe(
    map((result) =>
      toGuardResolution(
        result,

        auth.user(),
      ),
    ),
  );
}

/**
 * Compatibility helper.
 *
 * Dùng khi caller chỉ cần CurrentUser | null.
 *
 * Quan trọng:
 * unavailable vẫn emit null và COMPLETE.
 * Nó không bao giờ treo.
 */
export function resolveAuthenticatedUser(auth: AuthStore): Observable<CurrentUser | null> {
  return resolveAuthGuardState(auth).pipe(map((resolution) => resolution.user));
}

/**
 * User thật sự anonymous.
 */
export function createLoginRequiredUrlTree(
  router: Router,

  state: RouterStateSnapshot,
): UrlTree {
  return router.createUrlTree(['/dang-nhap'], {
    queryParams: {
      returnUrl: state.url,
    },
  });
}

/**
 * Session chưa được xác minh vì network/backend
 * đang tạm thời không khả dụng.
 *
 * Không redirect login.
 */
export function createAuthTemporarilyUnavailableUrlTree(
  router: Router,

  state: RouterStateSnapshot,
): UrlTree {
  return router.createUrlTree(['/tam-thoi-khong-the-xac-thuc'], {
    queryParams: {
      returnUrl: state.url,
    },
  });
}

export type AccessDeniedReason = 'role' | 'permission';

/**
 * User đã authenticated nhưng thiếu authorization.
 */
export function createAccessDeniedUrlTree(
  router: Router,

  state: RouterStateSnapshot,

  reason: AccessDeniedReason,
): UrlTree {
  return router.createUrlTree(['/khong-co-quyen'], {
    queryParams: {
      reason,

      from: state.url,
    },
  });
}

function toGuardResolution(
  result: AuthBootstrapResult,

  user: CurrentUser | null,
): AuthGuardResolution {
  if (result === 'authenticated' && user) {
    return {
      kind: 'authenticated',

      user,
    };
  }

  if (result === 'anonymous') {
    return {
      kind: 'anonymous',

      user: null,
    };
  }

  return {
    kind: 'unavailable',

    user: null,
  };
}

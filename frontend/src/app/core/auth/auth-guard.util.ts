import { toObservable } from '@angular/core/rxjs-interop';

import { Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { filter, map, Observable, of, take } from 'rxjs';

import { CurrentUser } from './auth.models';

import { AuthStore } from './auth.store';

/**
 * Trả về CurrentUser sau khi AuthStore
 * đã xác định xong trạng thái đăng nhập.
 *
 * Guard không được đọc user() ngay khi
 * status vẫn là idle/loading vì lúc đó app
 * có thể đang restore session bằng refresh token.
 */
export function resolveAuthenticatedUser(auth: AuthStore): Observable<CurrentUser | null> {
  const currentStatus = auth.status();

  if (currentStatus === 'authenticated') {
    return of(auth.user());
  }

  if (currentStatus === 'anonymous') {
    return of(null);
  }

  /**
   * initialize() có cơ chế bootstrapped,
   * nên gọi nhiều lần vẫn an toàn.
   */
  auth.initialize();

  return toObservable(auth.status).pipe(
    filter((status) => status !== 'idle' && status !== 'loading'),

    take(1),

    map((status) => {
      if (status !== 'authenticated') {
        return null;
      }

      return auth.user();
    }),
  );
}

/**
 * Anonymous user.
 *
 * Không redirect thẳng về home nữa.
 * Chuyển tới gateway login và giữ URL
 * mà user ban đầu muốn truy cập.
 */
export function createLoginRequiredUrlTree(router: Router, state: RouterStateSnapshot): UrlTree {
  return router.createUrlTree(['/dang-nhap'], {
    queryParams: {
      returnUrl: state.url,
    },
  });
}

export type AccessDeniedReason = 'role' | 'permission';

/**
 * User đã login nhưng thiếu quyền.
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

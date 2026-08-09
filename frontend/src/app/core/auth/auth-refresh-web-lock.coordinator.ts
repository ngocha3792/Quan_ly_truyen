import { defer, firstValueFrom, Observable } from 'rxjs';

import { AUTH_REFRESH_LOCK_NAME } from './auth-refresh-coordination.models';

export class AuthRefreshWebLockCoordinator {
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function';
  }

  runExclusive<T>(operation: () => Observable<T>): Observable<T> {
    return defer(async () =>
      navigator.locks.request(AUTH_REFRESH_LOCK_NAME, { mode: 'exclusive' }, async () =>
        firstValueFrom(operation()),
      ),
    );
  }
}

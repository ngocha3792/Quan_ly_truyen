import { Injectable, OnDestroy } from '@angular/core';
import { defer, from, Observable } from 'rxjs';

import { AuthRefreshStorageLeaseCoordinator } from './auth-refresh-storage-lease.coordinator';
import { AuthRefreshWebLockCoordinator } from './auth-refresh-web-lock.coordinator';

export { AuthRefreshCoordinationUnavailableError } from './auth-refresh-coordination.models';

/** Selects the strongest cross-tab refresh coordination mechanism available. */
@Injectable({ providedIn: 'root' })
export class AuthRefreshCoordinatorService implements OnDestroy {
  private readonly webLockCoordinator = AuthRefreshWebLockCoordinator.isSupported()
    ? new AuthRefreshWebLockCoordinator()
    : null;

  private readonly storageLeaseCoordinator =
    !this.webLockCoordinator && typeof window !== 'undefined'
      ? new AuthRefreshStorageLeaseCoordinator()
      : null;

  runExclusive<T>(operation: () => Observable<T>): Observable<T> {
    if (this.webLockCoordinator) {
      return this.webLockCoordinator.runExclusive(operation);
    }

    // SSR has no competing browser tabs.
    if (typeof window === 'undefined') {
      return defer(operation);
    }

    return defer(() => from(this.storageLeaseCoordinator!.runExclusive(operation)));
  }

  ngOnDestroy(): void {
    this.storageLeaseCoordinator?.destroy();
  }
}

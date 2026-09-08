import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import type { AuthSessionLifecycleEvent } from '../auth/auth-session-lifecycle.service';
import { AuthSessionLifecycleService } from '../auth/auth-session-lifecycle.service';
import { AuthStore } from '../auth/auth.store';
import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import type { ApiSuccessEnvelope } from '../http/api-envelope.model';
import { getApiErrorMessage } from '../http/api-error.util';
import { ServiceWorkerRegistrationService } from '../pwa/service-worker-registration.service';
import { OfflineConnectivityService } from './offline-connectivity.service';
import { OfflineDbService } from './offline-db.service';
import { parseOfflinePackageSummaries } from './offline-package-summary.parser';
import type { OfflinePackageRecord, OfflineStorageScope } from './offline.models';
import { clearLegacyPendingReadingProgress } from './offline-session-storage.util';
import { isOfflineLicenseExpired } from './offline-storage.policy';

const RECONCILE_INTERVAL_MS = 4 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class OfflineSessionCoordinatorService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly lifecycle = inject(AuthSessionLifecycleService);
  private readonly auth = inject(AuthStore);
  private readonly database = inject(OfflineDbService);
  private readonly serviceWorker = inject(ServiceWorkerRegistrationService);
  private readonly connectivity = inject(OfflineConnectivityService);
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly lastErrorState = signal<string | null>(null);
  private readonly accessRevisionState = signal(0);
  private initialized = false;
  private offlineRestoreAllowed = false;
  private taskTail: Promise<void> = Promise.resolve();
  private reconcileTimer: number | null = null;

  readonly lastError = this.lastErrorState.asReadonly();
  readonly accessRevision = this.accessRevisionState.asReadonly();

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.lifecycle.changes$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.handleLifecycleEvent(event));
    this.connectivity.onlineChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((online) => {
        if (online && this.auth.isAuthenticated() && this.database.activeScope()) {
          this.schedule(() => this.reconcileWithServer());
        }
      });
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      this.reconcileTimer = window.setInterval(this.reconcileWhenVisible, RECONCILE_INTERVAL_MS);
      document.addEventListener('visibilitychange', this.reconcileWhenVisible);
      this.destroyRef.onDestroy(() => {
        if (this.reconcileTimer) window.clearInterval(this.reconcileTimer);
        document.removeEventListener('visibilitychange', this.reconcileWhenVisible);
      });
    }

    if (!this.config.features.offlineReadingEnabled) {
      this.clearSessionData();
      return;
    }

    this.offlineRestoreAllowed = true;
    const scope = this.lifecycle.scope();
    if (scope) this.activateScope(scope);
  }

  whenSettled(): Promise<void> {
    return this.taskTail;
  }

  async ensureOfflineScope(): Promise<boolean> {
    if (this.database.activeScope()) return true;
    if (!this.offlineRestoreAllowed || !this.config.features.offlineReadingEnabled) return false;
    const restored = await this.database.restoreStoredScope();
    if (!restored) return false;
    await this.serviceWorker.setPrivateScope(null);
    const cleanup = await this.database.cleanup();
    if (cleanup.removedAssetUrls.length) {
      await this.serviceWorker.clearPrivateCaches();
    }
    await this.serviceWorker.setPrivateScope(restored);
    return true;
  }

  reconcileWithServer(): Promise<number> {
    if (
      !this.config.features.offlineReadingEnabled ||
      !this.connectivity.online() ||
      !this.auth.isAuthenticated() ||
      !this.database.activeScope()
    ) {
      return Promise.resolve(0);
    }
    return this.reconcileLocalPackages();
  }

  private handleLifecycleEvent(event: AuthSessionLifecycleEvent): void {
    if (event.kind === 'session-cleared' || event.kind === 'session-invalidated') {
      this.offlineRestoreAllowed = false;
      this.clearSessionData();
      return;
    }

    // access-lost means a temporary network/5xx failure; the refresh session may still be valid.
    if (event.kind === 'access-lost') {
      this.offlineRestoreAllowed = true;
      if (!this.database.activeScope()) this.schedule(() => this.ensureOfflineScope());
      return;
    }

    if (event.kind === 'session-established' && event.scope) {
      this.offlineRestoreAllowed = false;
      if (this.config.features.offlineReadingEnabled) this.activateScope(event.scope);
      else this.clearSessionData();
    }
  }

  private activateScope(scope: OfflineStorageScope): void {
    const previous = this.database.activeScope();
    const switchingOwner = Boolean(
      previous && (previous.userId !== scope.userId || previous.sessionId !== scope.sessionId),
    );
    if (switchingOwner) {
      this.accessRevisionState.update((revision) => revision + 1);
      if (typeof localStorage !== 'undefined') clearLegacyPendingReadingProgress(localStorage);
    }
    void this.serviceWorker.setPrivateScope(null);
    const activation = this.database.activateScope(scope);
    this.schedule(async () => {
      const ownerChanged = await activation;
      if (ownerChanged && typeof localStorage !== 'undefined') {
        clearLegacyPendingReadingProgress(localStorage);
      }
      const cleanup = await this.database.cleanup();
      if (ownerChanged || cleanup.removedAssetUrls.length) {
        await this.serviceWorker.clearPrivateCaches();
      }
      await this.serviceWorker.setPrivateScope(scope);
      if (this.connectivity.online() && this.auth.isAuthenticated()) {
        await this.reconcileLocalPackages();
      }
    });
  }

  private clearSessionData(): void {
    this.accessRevisionState.update((revision) => revision + 1);
    if (typeof localStorage !== 'undefined') clearLegacyPendingReadingProgress(localStorage);
    const databaseClear = this.database.deactivateAndClear();
    const cacheClear = this.serviceWorker.clearPrivateCaches();
    this.schedule(async () => {
      await Promise.all([databaseClear, cacheClear]);
      this.lastErrorState.set(null);
    });
  }

  private async reconcileLocalPackages(): Promise<number> {
    try {
      const envelope = await firstValueFrom(
        this.http.get<ApiSuccessEnvelope<unknown>>(`${this.config.apiBaseUrl}/offline-packages`),
      );
      const remote = parseOfflinePackageSummaries(envelope.data);
      const remoteById = new Map(remote.map((item) => [item.id, item]));
      const local = await this.database.listPackages();
      let removed = 0;

      for (const item of local) {
        const server = remoteById.get(item.id);
        if (
          !server ||
          server.status !== 'READY' ||
          isOfflineLicenseExpired(server.licenseExpiresAt)
        ) {
          await this.removeLocalPackage(item);
          removed += 1;
          continue;
        }

        if (server.licenseExpiresAt !== item.licenseExpiresAt || server.status !== item.status) {
          await this.database.savePackage({
            ...item,
            status: server.status,
            licenseExpiresAt: server.licenseExpiresAt,
          });
        }
      }

      this.lastErrorState.set(null);
      return removed;
    } catch (error) {
      // Network failure does not prove revocation. The local license remains the offline ceiling.
      this.lastErrorState.set(
        getApiErrorMessage(error, 'Chưa thể kiểm tra lại giấy phép offline.'),
      );
      return 0;
    }
  }

  private async removeLocalPackage(item: OfflinePackageRecord): Promise<void> {
    if (item.assetUrls.length) await this.serviceWorker.removeManifestAssets(item.assetUrls);
    await this.database.deletePackage(item.id);
  }

  private readonly reconcileWhenVisible = (): void => {
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible' &&
      this.connectivity.online() &&
      this.auth.isAuthenticated() &&
      this.database.activeScope()
    ) {
      this.schedule(() => this.reconcileWithServer());
    }
  };

  private schedule(task: () => Promise<unknown>): void {
    this.taskTail = this.taskTail.then(task, task).then(
      () => undefined,
      (error: unknown) => {
        this.lastErrorState.set(
          getApiErrorMessage(error, 'Không thể cập nhật dữ liệu offline trên thiết bị.'),
        );
      },
    );
  }
}

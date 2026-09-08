import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { AuthSessionLifecycleService } from '../auth/auth-session-lifecycle.service';
import { AuthStore } from '../auth/auth.store';
import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import { getApiErrorCode, getApiErrorMessage } from '../http/api-error.util';
import { ReaderEngagementApiClient } from '../http/reader-engagement-api.client';
import { OfflineConnectivityService } from './offline-connectivity.service';
import { OfflineDbService } from './offline-db.service';
import type {
  OfflineProgressInput,
  OfflineProgressRecord,
  OfflineSyncResult,
} from './offline.models';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private readonly database = inject(OfflineDbService);
  private readonly api = inject(ReaderEngagementApiClient);
  private readonly auth = inject(AuthStore);
  private readonly lifecycle = inject(AuthSessionLifecycleService);
  private readonly connectivity = inject(OfflineConnectivityService);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly pendingCountState = signal(0);
  private readonly syncingState = signal(false);
  private readonly lastErrorState = signal<string | null>(null);
  private initialized = false;
  private syncPromise: Promise<OfflineSyncResult> | null = null;

  readonly pendingCount = this.pendingCountState.asReadonly();
  readonly syncing = this.syncingState.asReadonly();
  readonly lastError = this.lastErrorState.asReadonly();

  initialize(): void {
    if (!this.browser || this.initialized || !this.config.features.offlineReadingEnabled) return;
    this.initialized = true;
    this.connectivity.onlineChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((online) => {
        if (online) void this.syncPending();
      });
    this.lifecycle.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event.kind === 'session-established') {
        void this.refreshPendingCount().then(() => {
          if (this.connectivity.online()) void this.syncPending();
        });
      } else if (event.kind === 'session-cleared' || event.kind === 'session-invalidated') {
        this.pendingCountState.set(0);
        this.lastErrorState.set(null);
      }
    });
  }

  async queueProgress(input: OfflineProgressInput): Promise<void> {
    validateProgress(input);
    const queuedAt = input.lastReadAt ?? new Date().toISOString();
    const record: OfflineProgressRecord = {
      ...input,
      position: Math.max(0, Math.trunc(input.position)),
      lastReadAt: queuedAt,
      queuedAt,
      attemptCount: 0,
    };
    await this.database.savePendingProgress(record);
    await this.refreshPendingCount();
    if (this.connectivity.online() && this.auth.isAuthenticated()) void this.syncPending();
  }

  syncPending(): Promise<OfflineSyncResult> {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.performSync().finally(() => {
      this.syncPromise = null;
      this.syncingState.set(false);
    });
    return this.syncPromise;
  }

  async refreshPendingCount(): Promise<number> {
    try {
      const pending = await this.database.listPendingProgress();
      this.pendingCountState.set(pending.length);
      return pending.length;
    } catch {
      this.pendingCountState.set(0);
      return 0;
    }
  }

  private async performSync(): Promise<OfflineSyncResult> {
    if (
      !this.browser ||
      !this.config.features.offlineReadingEnabled ||
      !this.connectivity.online() ||
      !this.auth.isAuthenticated()
    ) {
      return { synced: 0, remaining: await this.refreshPendingCount() };
    }

    this.syncingState.set(true);
    this.lastErrorState.set(null);
    const scopeAtStart = this.database.activeScope();
    const pending = await this.database.listPendingProgress();
    let synced = 0;

    for (const item of pending) {
      const currentScope = this.database.activeScope();
      if (
        !scopeAtStart ||
        !currentScope ||
        currentScope.userId !== scopeAtStart.userId ||
        currentScope.sessionId !== scopeAtStart.sessionId ||
        !this.connectivity.online() ||
        !this.auth.isAuthenticated()
      ) {
        break;
      }

      try {
        await firstValueFrom(
          this.api.saveReadingProgress(
            item.storyId,
            item.chapterId,
            item.position,
            item.cursor,
            this.config.features.realtimeProgressSyncEnabled
              ? {
                  baseRevision: item.baseRevision,
                  deviceId: item.deviceId,
                  clientEventId: item.clientEventId,
                }
              : undefined,
          ),
        );
        if (await this.database.deletePendingProgress(item.storyId, item.clientEventId))
          synced += 1;
      } catch (error) {
        if (getApiErrorCode(error) === 'READING_PROGRESS_REVISION_CONFLICT') {
          await this.database.deletePendingProgress(item.storyId, item.clientEventId);
          continue;
        }
        await this.database.incrementProgressAttempt(item.storyId, item.clientEventId);
        this.lastErrorState.set(getApiErrorMessage(error, 'Chưa thể đồng bộ tiến độ đọc offline.'));
        break;
      }
    }

    const remaining = await this.refreshPendingCount();
    return { synced, remaining };
  }
}

function validateProgress(input: OfflineProgressInput): void {
  if (!input.storyId.trim() || !input.chapterId.trim()) {
    throw new Error('Tiến độ offline thiếu storyId hoặc chapterId.');
  }
  if (!Number.isFinite(input.position) || input.position < 0) {
    throw new Error('Vị trí đọc offline không hợp lệ.');
  }
  if (!Number.isSafeInteger(input.baseRevision) || input.baseRevision < 0) {
    throw new Error('Revision tiến độ offline không hợp lệ.');
  }
  if (!input.deviceId.trim() || !UUID_PATTERN.test(input.clientEventId)) {
    throw new Error('Định danh đồng bộ tiến độ offline không hợp lệ.');
  }
}

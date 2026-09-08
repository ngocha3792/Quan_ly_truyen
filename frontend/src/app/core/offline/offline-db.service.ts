import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

import { readOfflineChapterBundle, readOfflinePackageEntry } from './offline-chapter.storage';
import {
  normalizeScope,
  offlineScopeKey,
  openNativeOfflineDatabase,
  withoutScope,
} from './offline-db.internal';
import {
  clearOfflineStores,
  readOfflineOwner,
  writeOfflineOwner,
} from './offline-db-metadata.storage';
import {
  deleteOfflinePackage,
  markOfflinePackageReady,
  readOfflinePackage,
  readOfflinePackages,
  saveOfflineChapter,
  saveOfflineMedia,
  saveOfflinePackage,
} from './offline-package.storage';
import {
  deleteReservedOfflinePackage,
  reserveOfflinePackage,
  saveReservedOfflineChapter,
  saveReservedOfflineMedia,
} from './offline-package-reservation.storage';
import {
  deleteOfflineProgress,
  incrementOfflineProgressAttempt,
  listOfflineProgress,
  saveOfflineProgress,
} from './offline-progress.storage';
import type {
  OfflineChapterBundle,
  OfflineChapterRecord,
  OfflineCleanupResult,
  OfflineMediaRecord,
  OfflinePackageEntry,
  OfflinePackageRecord,
  OfflineProgressRecord,
  OfflineStorageEstimate,
  OfflineStorageScope,
} from './offline.models';
import { OfflineStorageScopeError, OfflineStorageUnavailableError } from './offline.models';
import {
  resolveOfflineBudget,
  isOfflineReservationExpired,
  selectOfflinePackagesForEviction,
  withOfflineUsage,
} from './offline-storage.policy';

@Injectable({ providedIn: 'root' })
export class OfflineDbService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly activeScopeState = signal<OfflineStorageScope | null>(null);
  private databasePromise: Promise<IDBDatabase> | null = null;
  private operationTail: Promise<void> = Promise.resolve();
  private scopeRevision = 0;

  readonly activeScope = this.activeScopeState.asReadonly();
  readonly supported = this.browser && typeof indexedDB !== 'undefined';

  activateScope(scope: OfflineStorageScope): Promise<boolean> {
    const normalized = normalizeScope(scope);
    const nextKey = offlineScopeKey(normalized);
    const revision = ++this.scopeRevision;
    this.activeScopeState.set(normalized);
    return this.enqueue(async () => {
      const database = await this.openDatabase();
      const owner = await readOfflineOwner(database);
      const ownerChanged = Boolean(owner && owner.scopeKey !== nextKey);
      if (ownerChanged) await clearOfflineStores(database);
      if (revision === this.scopeRevision && offlineScopeKey(this.requireScope()) === nextKey) {
        await writeOfflineOwner(database, normalized);
      }
      return ownerChanged;
    });
  }

  restoreStoredScope(): Promise<OfflineStorageScope | null> {
    const current = this.activeScopeState();
    if (current) return Promise.resolve(current);
    const revision = this.scopeRevision;
    return this.enqueue(async () => {
      const owner = await readOfflineOwner(await this.openDatabase());
      if (!owner || revision !== this.scopeRevision || this.activeScopeState()) return null;
      const restored = { userId: owner.userId, sessionId: owner.sessionId };
      this.activeScopeState.set(restored);
      return restored;
    });
  }

  deactivateAndClear(): Promise<void> {
    this.scopeRevision += 1;
    this.activeScopeState.set(null);
    return this.enqueue(async () => clearOfflineStores(await this.openDatabase(), true));
  }

  clearAll(): Promise<void> {
    return this.scoped(async (database, key, scope) => {
      void key;
      await clearOfflineStores(database);
      await writeOfflineOwner(database, scope);
    });
  }

  savePackage(record: OfflinePackageRecord): Promise<void> {
    return this.scoped((database, key) => saveOfflinePackage(database, key, record));
  }

  saveChapter(record: OfflineChapterRecord): Promise<void> {
    return this.scoped((database, key) => saveOfflineChapter(database, key, record));
  }

  saveMedia(record: OfflineMediaRecord): Promise<void> {
    return this.scoped((database, key) => saveOfflineMedia(database, key, record));
  }

  async reservePackage(record: OfflinePackageRecord): Promise<OfflineCleanupResult> {
    const estimate = await navigator.storage?.estimate?.();
    const budget = resolveOfflineBudget(estimate?.quota ?? 0);
    return this.scoped((database, key) => reserveOfflinePackage(database, key, record, budget));
  }

  saveReservedChapter(record: OfflineChapterRecord, reservationId: string): Promise<void> {
    return this.scoped((database, key) =>
      saveReservedOfflineChapter(database, key, record, reservationId),
    );
  }

  saveReservedMedia(record: OfflineMediaRecord, reservationId: string): Promise<void> {
    return this.scoped((database, key) =>
      saveReservedOfflineMedia(database, key, record, reservationId),
    );
  }

  markPackageReady(
    packageId: string,
    downloadedBytes: number,
    reservationId?: string,
  ): Promise<OfflinePackageRecord> {
    return this.scoped((database, key) =>
      markOfflinePackageReady(database, key, packageId, downloadedBytes, reservationId),
    );
  }

  listPackages(): Promise<readonly OfflinePackageRecord[]> {
    return this.scoped(async (database, key) =>
      (await readOfflinePackages(database, key))
        .map(withoutScope)
        .sort((left, right) => Date.parse(right.lastAccessedAt) - Date.parse(left.lastAccessedAt)),
    );
  }

  getPackage(packageId: string): Promise<OfflinePackageRecord | null> {
    return this.scoped((database, key) => readOfflinePackage(database, key, packageId));
  }

  async isDownloaded(packageId: string): Promise<boolean> {
    return (await this.getPackageEntry(packageId)) !== null;
  }

  getPackageEntry(packageId: string): Promise<OfflinePackageEntry | null> {
    return this.scoped((database, key) => readOfflinePackageEntry(database, key, packageId));
  }

  getOfflineChapter(
    storySlug: string,
    chapterNumber: number | string,
  ): Promise<OfflineChapterBundle | null> {
    const normalizedNumber = normalizeChapterNumber(chapterNumber);
    if (normalizedNumber === null) return Promise.resolve(null);
    return this.scoped((database, key) =>
      readOfflineChapterBundle(database, key, storySlug, normalizedNumber),
    );
  }

  deletePackage(packageId: string): Promise<OfflinePackageRecord | null> {
    return this.scoped((database, key) => deleteOfflinePackage(database, key, packageId));
  }

  deleteReservedPackage(
    packageId: string,
    reservationId: string,
  ): Promise<OfflinePackageRecord | null> {
    return this.scoped((database, key) =>
      deleteReservedOfflinePackage(database, key, packageId, reservationId),
    );
  }

  savePendingProgress(record: OfflineProgressRecord): Promise<void> {
    return this.scoped((database, key) => saveOfflineProgress(database, key, record));
  }

  listPendingProgress(): Promise<readonly OfflineProgressRecord[]> {
    return this.scoped((database, key) => listOfflineProgress(database, key));
  }

  deletePendingProgress(storyId: string, clientEventId: string): Promise<boolean> {
    return this.scoped((database, key) =>
      deleteOfflineProgress(database, key, storyId, clientEventId),
    );
  }

  incrementProgressAttempt(storyId: string, clientEventId: string): Promise<void> {
    return this.scoped((database, key) =>
      incrementOfflineProgressAttempt(database, key, storyId, clientEventId),
    );
  }

  async estimateStorage(): Promise<OfflineStorageEstimate> {
    if (!this.supported) return withOfflineUsage(0, 0, []);
    const packages = this.activeScopeState() ? await this.listPackages() : [];
    const estimate = await navigator.storage?.estimate?.();
    return withOfflineUsage(estimate?.usage ?? 0, estimate?.quota ?? 0, packages);
  }

  async cleanup(requiredBytes = 0, excludedPackageId?: string): Promise<OfflineCleanupResult> {
    const scope = this.requireScope();
    const estimate = await navigator.storage?.estimate?.();
    const budget = resolveOfflineBudget(estimate?.quota ?? 0);
    return this.enqueue(async () => {
      this.assertScope(scope);
      const database = await this.openDatabase();
      const key = offlineScopeKey(scope);
      const stored = await readOfflinePackages(database, key);
      const incomplete = stored.filter(
        (item) => isOfflineReservationExpired(item) && item.id !== excludedPackageId,
      );
      const incompleteIds = new Set(incomplete.map((item) => item.id));
      const selected = selectOfflinePackagesForEviction(
        stored.filter((item) => !incompleteIds.has(item.id)).map(withoutScope),
        requiredBytes,
        budget,
        excludedPackageId,
      );
      const removals = [...incomplete.map(withoutScope), ...selected];
      const removedPackageIds: string[] = [];
      const assetUrls = new Set<string>();
      let freedBytes = 0;
      for (const item of removals) {
        const deleted = await deleteOfflinePackage(database, key, item.id);
        if (!deleted) continue;
        removedPackageIds.push(deleted.id);
        freedBytes += deleted.downloadedBytes;
        deleted.assetUrls.forEach((url) => assetUrls.add(url));
      }
      return { removedPackageIds, removedAssetUrls: [...assetUrls], freedBytes };
    });
  }

  private scoped<T>(
    operation: (database: IDBDatabase, scopeKey: string, scope: OfflineStorageScope) => Promise<T>,
  ): Promise<T> {
    const scope = this.requireScope();
    return this.enqueue(async () => {
      this.assertScope(scope);
      return operation(await this.openDatabase(), offlineScopeKey(scope), scope);
    });
  }

  private requireScope(): OfflineStorageScope {
    const scope = this.activeScopeState();
    if (!scope) throw new OfflineStorageScopeError();
    return scope;
  }

  private assertScope(expected: OfflineStorageScope): void {
    if (offlineScopeKey(this.requireScope()) !== offlineScopeKey(expected)) {
      throw new OfflineStorageScopeError();
    }
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation, operation);
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!this.supported) return Promise.reject(new OfflineStorageUnavailableError());
    this.databasePromise ??= openNativeOfflineDatabase(() => (this.databasePromise = null));
    return this.databasePromise;
  }
}

function normalizeChapterNumber(value: number | string): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

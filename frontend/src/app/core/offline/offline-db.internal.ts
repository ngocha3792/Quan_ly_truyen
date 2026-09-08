import type {
  OfflineChapterRecord,
  OfflineMediaRecord,
  OfflinePackageRecord,
  OfflineProgressRecord,
  OfflineStorageScope,
} from './offline.models';
import { OfflineStorageScopeError, OfflineStorageUnavailableError } from './offline.models';

export const OFFLINE_DATA_STORES = ['packages', 'chapters', 'media', 'progress'] as const;

export interface StoredMeta {
  readonly key: string;
  readonly scopeKey: string;
  readonly userId: string;
  readonly sessionId: string;
}

export type StoredPackage = OfflinePackageRecord & { readonly scopeKey: string };
export type StoredChapter = OfflineChapterRecord & { readonly scopeKey: string };
export type StoredMedia = OfflineMediaRecord & { readonly scopeKey: string };
export type StoredProgress = OfflineProgressRecord & { readonly scopeKey: string };

export function openNativeOfflineDatabase(onVersionChange: () => void): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new OfflineStorageUnavailableError());
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('truyenhub-offline', 1);
    request.addEventListener('upgradeneeded', () => configureDatabase(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB error')));
    request.addEventListener('blocked', () =>
      reject(new OfflineStorageUnavailableError('Không thể nâng cấp kho offline đang được mở.')),
    );
    request.addEventListener('success', () => {
      request.result.addEventListener('versionchange', () => {
        request.result.close();
        onVersionChange();
      });
      resolve(request.result);
    });
  });
}

export function configureDatabase(database: IDBDatabase): void {
  if (!database.objectStoreNames.contains('meta')) {
    database.createObjectStore('meta', { keyPath: 'key' });
  }
  if (!database.objectStoreNames.contains('packages')) {
    const store = database.createObjectStore('packages', { keyPath: ['scopeKey', 'id'] });
    store.createIndex('by-scope', 'scopeKey');
    store.createIndex('by-scope-last-accessed', ['scopeKey', 'lastAccessedAt']);
  }
  if (!database.objectStoreNames.contains('chapters')) {
    const store = database.createObjectStore('chapters', {
      keyPath: ['scopeKey', 'packageId', 'chapterId'],
    });
    store.createIndex('by-scope-package', ['scopeKey', 'packageId']);
    store.createIndex('by-scope-story-chapter', ['scopeKey', 'story.slug', 'number']);
  }
  if (!database.objectStoreNames.contains('media')) {
    const store = database.createObjectStore('media', {
      keyPath: ['scopeKey', 'packageId', 'id'],
    });
    store.createIndex('by-scope-package', ['scopeKey', 'packageId']);
    store.createIndex('by-scope-package-chapter', ['scopeKey', 'packageId', 'chapterId']);
  }
  if (!database.objectStoreNames.contains('progress')) {
    const store = database.createObjectStore('progress', {
      keyPath: ['scopeKey', 'storyId'],
    });
    store.createIndex('by-scope', 'scopeKey');
  }
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB error')));
  });
}

export function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve());
    transaction.addEventListener('abort', () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted')),
    );
    transaction.addEventListener('error', () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed')),
    );
  });
}

export function normalizeScope(scope: OfflineStorageScope): OfflineStorageScope {
  const userId = scope.userId.trim();
  const sessionId = scope.sessionId.trim();
  if (!userId || !sessionId) throw new OfflineStorageScopeError();
  return { userId, sessionId };
}

export function offlineScopeKey(scope: OfflineStorageScope): string {
  return `${scope.userId}:${scope.sessionId}`;
}

export function withoutScope<T extends { readonly scopeKey: string }>(
  record: T,
): Omit<T, 'scopeKey'> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'scopeKey')) as Omit<
    T,
    'scopeKey'
  >;
}

export function isStoredPackageReadable(record: OfflinePackageRecord, now = Date.now()): boolean {
  if (record.downloadState !== 'READY' || record.status !== 'READY') return false;
  if (!record.licenseExpiresAt) return true;
  const expiresAt = Date.parse(record.licenseExpiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

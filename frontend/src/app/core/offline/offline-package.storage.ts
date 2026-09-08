import type {
  OfflineChapterRecord,
  OfflineMediaRecord,
  OfflinePackageRecord,
} from './offline.models';
import { requestResult, transactionComplete, withoutScope } from './offline-db.internal';
import type { StoredChapter, StoredMedia, StoredPackage } from './offline-db.internal';

export function saveOfflinePackage(
  database: IDBDatabase,
  scopeKey: string,
  record: OfflinePackageRecord,
): Promise<void> {
  return putRecord(database, 'packages', { ...record, scopeKey } satisfies StoredPackage);
}

export function saveOfflineChapter(
  database: IDBDatabase,
  scopeKey: string,
  record: OfflineChapterRecord,
): Promise<void> {
  return putRecord(database, 'chapters', { ...record, scopeKey } satisfies StoredChapter);
}

export function saveOfflineMedia(
  database: IDBDatabase,
  scopeKey: string,
  record: OfflineMediaRecord,
): Promise<void> {
  return putRecord(database, 'media', { ...record, scopeKey } satisfies StoredMedia);
}

export async function markOfflinePackageReady(
  database: IDBDatabase,
  scopeKey: string,
  packageId: string,
  downloadedBytes: number,
  reservationId?: string,
): Promise<OfflinePackageRecord> {
  const transaction = database.transaction('packages', 'readwrite');
  const done = transactionComplete(transaction);
  const store = transaction.objectStore('packages');
  const stored = (await requestResult(store.get([scopeKey, packageId]))) as
    StoredPackage | undefined;
  if (!stored) throw new Error('Gói offline đang tải không còn tồn tại.');
  if (reservationId && stored.reservationId !== reservationId) {
    throw new Error('Reservation tải offline đã bị thay thế.');
  }
  const ready: StoredPackage = {
    ...stored,
    downloadState: 'READY',
    downloadedBytes,
    lastAccessedAt: new Date().toISOString(),
    reservationId: null,
    reservationExpiresAt: null,
  };
  await requestResult(store.put(ready));
  await done;
  return withoutScope(ready);
}

export async function readOfflinePackages(
  database: IDBDatabase,
  scopeKey: string,
): Promise<StoredPackage[]> {
  return (await requestResult(
    database
      .transaction('packages', 'readonly')
      .objectStore('packages')
      .index('by-scope')
      .getAll(IDBKeyRange.only(scopeKey)),
  )) as StoredPackage[];
}

export async function readOfflinePackage(
  database: IDBDatabase,
  scopeKey: string,
  packageId: string,
): Promise<OfflinePackageRecord | null> {
  const stored = (await requestResult(
    database.transaction('packages', 'readonly').objectStore('packages').get([scopeKey, packageId]),
  )) as StoredPackage | undefined;
  return stored ? withoutScope(stored) : null;
}

export async function deleteOfflinePackage(
  database: IDBDatabase,
  scopeKey: string,
  packageId: string,
): Promise<OfflinePackageRecord | null> {
  const transaction = database.transaction(['packages', 'chapters', 'media'], 'readwrite');
  const done = transactionComplete(transaction);
  const packageStore = transaction.objectStore('packages');
  const packageKey: IDBValidKey = [scopeKey, packageId];
  const stored = (await requestResult(packageStore.get(packageKey))) as StoredPackage | undefined;
  if (!stored) {
    await done;
    return null;
  }
  const chapters = (await requestResult(
    transaction
      .objectStore('chapters')
      .index('by-scope-package')
      .getAll(IDBKeyRange.only([scopeKey, packageId])),
  )) as StoredChapter[];
  const media = (await requestResult(
    transaction
      .objectStore('media')
      .index('by-scope-package')
      .getAll(IDBKeyRange.only([scopeKey, packageId])),
  )) as StoredMedia[];

  packageStore.delete(packageKey);
  const chapterStore = transaction.objectStore('chapters');
  chapters.forEach((chapter) => chapterStore.delete([scopeKey, packageId, chapter.chapterId]));
  const mediaStore = transaction.objectStore('media');
  media.forEach((item) => mediaStore.delete([scopeKey, packageId, item.id]));
  await done;
  return withoutScope(stored);
}

async function putRecord(database: IDBDatabase, storeName: string, value: unknown): Promise<void> {
  const transaction = database.transaction(storeName, 'readwrite');
  const done = transactionComplete(transaction);
  await requestResult(transaction.objectStore(storeName).put(value));
  await done;
}

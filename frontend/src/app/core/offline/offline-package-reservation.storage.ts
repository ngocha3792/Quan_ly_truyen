import type {
  OfflineChapterRecord,
  OfflineCleanupResult,
  OfflineMediaRecord,
  OfflinePackageRecord,
} from './offline.models';
import { OfflineStorageScopeError } from './offline.models';
import { requestResult, transactionComplete, withoutScope } from './offline-db.internal';
import type { StoredChapter, StoredMedia, StoredPackage } from './offline-db.internal';
import {
  assertOfflineReservationReplaceable,
  isOfflineReservationExpired,
  selectOfflinePackagesForEviction,
} from './offline-storage.policy';

export async function reserveOfflinePackage(
  database: IDBDatabase,
  scopeKey: string,
  record: OfflinePackageRecord,
  budgetBytes: number,
): Promise<OfflineCleanupResult> {
  if (!record.reservationId || !record.reservationExpiresAt) {
    throw new OfflineStorageScopeError('Reservation tải offline không hợp lệ.');
  }
  const transaction = database.transaction(['packages', 'chapters', 'media'], 'readwrite');
  const done = transactionComplete(transaction);
  const packages = (await requestResult(
    transaction.objectStore('packages').index('by-scope').getAll(IDBKeyRange.only(scopeKey)),
  )) as StoredPackage[];
  const now = Date.now();
  const existing = packages.find((item) => item.id === record.id);
  try {
    assertOfflineReservationReplaceable(existing, record.reservationId, now);
  } catch (error) {
    await done;
    throw error;
  }
  const stale = packages.filter(
    (item) => item.id !== record.id && isOfflineReservationExpired(item, now),
  );
  const staleIds = new Set(stale.map((item) => item.id));
  const selected = selectOfflinePackagesForEviction(
    packages.filter((item) => !staleIds.has(item.id)).map(withoutScope),
    record.totalSizeBytes,
    budgetBytes,
    record.id,
    now,
  );
  const removals = [
    ...stale,
    ...selected.map((item) => ({ ...item, scopeKey }) satisfies StoredPackage),
    ...(existing ? [existing] : []),
  ];
  const unique = [...new Map(removals.map((item) => [item.id, item])).values()];
  const removedAssetUrls = new Set<string>();
  let freedBytes = 0;

  for (const item of unique) {
    await deletePackageRecords(transaction, scopeKey, item.id);
    item.assetUrls.forEach((url) => removedAssetUrls.add(url));
    freedBytes += item.downloadedBytes;
  }
  await requestResult(
    transaction.objectStore('packages').put({ ...record, scopeKey } satisfies StoredPackage),
  );
  await done;
  return {
    removedPackageIds: unique.map((item) => item.id),
    removedAssetUrls: [...removedAssetUrls],
    freedBytes,
  };
}

export function saveReservedOfflineChapter(
  database: IDBDatabase,
  scopeKey: string,
  record: OfflineChapterRecord,
  reservationId: string,
): Promise<void> {
  return putReservedRecord(database, scopeKey, record.packageId, reservationId, 'chapters', {
    ...record,
    scopeKey,
  } satisfies StoredChapter);
}

export function saveReservedOfflineMedia(
  database: IDBDatabase,
  scopeKey: string,
  record: OfflineMediaRecord,
  reservationId: string,
): Promise<void> {
  return putReservedRecord(database, scopeKey, record.packageId, reservationId, 'media', {
    ...record,
    scopeKey,
  } satisfies StoredMedia);
}

export async function deleteReservedOfflinePackage(
  database: IDBDatabase,
  scopeKey: string,
  packageId: string,
  reservationId: string,
): Promise<OfflinePackageRecord | null> {
  const transaction = database.transaction(['packages', 'chapters', 'media'], 'readwrite');
  const done = transactionComplete(transaction);
  const stored = (await requestResult(
    transaction.objectStore('packages').get([scopeKey, packageId]),
  )) as StoredPackage | undefined;
  if (!stored || stored.reservationId !== reservationId) {
    await done;
    return null;
  }
  await deletePackageRecords(transaction, scopeKey, packageId);
  await done;
  return withoutScope(stored);
}

async function putReservedRecord(
  database: IDBDatabase,
  scopeKey: string,
  packageId: string,
  reservationId: string,
  storeName: 'chapters' | 'media',
  value: unknown,
): Promise<void> {
  const transaction = database.transaction(['packages', storeName], 'readwrite');
  const done = transactionComplete(transaction);
  const stored = (await requestResult(
    transaction.objectStore('packages').get([scopeKey, packageId]),
  )) as StoredPackage | undefined;
  if (stored?.reservationId !== reservationId) {
    await done;
    throw new OfflineStorageScopeError('Reservation tải offline đã bị thay thế.');
  }
  await requestResult(transaction.objectStore(storeName).put(value));
  await done;
}

async function deletePackageRecords(
  transaction: IDBTransaction,
  scopeKey: string,
  packageId: string,
): Promise<void> {
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
  transaction.objectStore('packages').delete([scopeKey, packageId]);
  chapters.forEach((item) =>
    transaction.objectStore('chapters').delete([scopeKey, packageId, item.chapterId]),
  );
  media.forEach((item) => transaction.objectStore('media').delete([scopeKey, packageId, item.id]));
}

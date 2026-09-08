import type { OfflineStorageScope } from './offline.models';
import {
  OFFLINE_DATA_STORES,
  offlineScopeKey,
  requestResult,
  transactionComplete,
} from './offline-db.internal';
import type { StoredMeta } from './offline-db.internal';

const OWNER_META_KEY = 'owner-scope';

export async function readOfflineOwner(database: IDBDatabase): Promise<StoredMeta | null> {
  const result = (await requestResult(
    database.transaction('meta', 'readonly').objectStore('meta').get(OWNER_META_KEY),
  )) as StoredMeta | undefined;
  return result ?? null;
}

export async function writeOfflineOwner(
  database: IDBDatabase,
  scope: OfflineStorageScope,
): Promise<void> {
  const transaction = database.transaction('meta', 'readwrite');
  const done = transactionComplete(transaction);
  await requestResult(
    transaction.objectStore('meta').put({
      key: OWNER_META_KEY,
      scopeKey: offlineScopeKey(scope),
      userId: scope.userId,
      sessionId: scope.sessionId,
    } satisfies StoredMeta),
  );
  await done;
}

export async function clearOfflineStores(
  database: IDBDatabase,
  includeMeta = false,
): Promise<void> {
  const stores: string[] = includeMeta
    ? [...OFFLINE_DATA_STORES, 'meta']
    : [...OFFLINE_DATA_STORES];
  const transaction = database.transaction(stores, 'readwrite');
  const done = transactionComplete(transaction);
  for (const name of stores) transaction.objectStore(name).clear();
  await done;
}

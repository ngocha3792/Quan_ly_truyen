import type { OfflineProgressRecord } from './offline.models';
import { requestResult, transactionComplete, withoutScope } from './offline-db.internal';
import type { StoredProgress } from './offline-db.internal';

export async function saveOfflineProgress(
  database: IDBDatabase,
  scopeKey: string,
  record: OfflineProgressRecord,
): Promise<void> {
  const transaction = database.transaction('progress', 'readwrite');
  const done = transactionComplete(transaction);
  await requestResult(
    transaction.objectStore('progress').put({ ...record, scopeKey } satisfies StoredProgress),
  );
  await done;
}

export async function listOfflineProgress(
  database: IDBDatabase,
  scopeKey: string,
): Promise<readonly OfflineProgressRecord[]> {
  const records = (await requestResult(
    database
      .transaction('progress', 'readonly')
      .objectStore('progress')
      .index('by-scope')
      .getAll(IDBKeyRange.only(scopeKey)),
  )) as StoredProgress[];
  return records
    .map(withoutScope)
    .sort((left, right) => Date.parse(left.queuedAt) - Date.parse(right.queuedAt));
}

export async function deleteOfflineProgress(
  database: IDBDatabase,
  scopeKey: string,
  storyId: string,
  expectedClientEventId: string,
): Promise<boolean> {
  const transaction = database.transaction('progress', 'readwrite');
  const done = transactionComplete(transaction);
  const store = transaction.objectStore('progress');
  const key: IDBValidKey = [scopeKey, storyId];
  const stored = (await requestResult(store.get(key))) as StoredProgress | undefined;
  if (!stored || stored.clientEventId !== expectedClientEventId) {
    await done;
    return false;
  }
  await requestResult(store.delete(key));
  await done;
  return true;
}

export async function incrementOfflineProgressAttempt(
  database: IDBDatabase,
  scopeKey: string,
  storyId: string,
  expectedClientEventId: string,
): Promise<void> {
  const transaction = database.transaction('progress', 'readwrite');
  const done = transactionComplete(transaction);
  const store = transaction.objectStore('progress');
  const stored = (await requestResult(store.get([scopeKey, storyId]))) as
    StoredProgress | undefined;
  if (stored?.clientEventId === expectedClientEventId) {
    await requestResult(store.put({ ...stored, attemptCount: stored.attemptCount + 1 }));
  }
  await done;
}

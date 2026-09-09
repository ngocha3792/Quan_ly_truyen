import { Injectable } from '@angular/core';

interface RecoveryEntry {
  chapterId: string;
  title: string;
  content: string;
  savedAt: number;
}

@Injectable()
export class ChapterLocalRecoveryService {
  private readonly database = 'truyenhub-author-recovery';
  private readonly store = 'drafts';
  async save(entry: Omit<RecoveryEntry, 'savedAt'>): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    const db = await this.open();
    await this.transaction(db, 'readwrite', (store) =>
      store.put({ ...entry, savedAt: Date.now() }),
    );
  }
  async get(chapterId: string): Promise<RecoveryEntry | null> {
    if (typeof indexedDB === 'undefined') return null;
    const db = await this.open();
    return this.transaction<RecoveryEntry | undefined>(db, 'readonly', (store) =>
      store.get(chapterId),
    ).then((entry) => entry ?? null);
  }
  async clear(chapterId: string): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    const db = await this.open();
    await this.transaction(db, 'readwrite', (store) => store.delete(chapterId));
  }
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.database, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore(this.store, { keyPath: 'chapterId' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  private transaction<T = unknown>(
    db: IDBDatabase,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T> | void,
  ): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.store, mode);
      const result = action(tx.objectStore(this.store));
      tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
      tx.onerror = () => reject(tx.error);
    });
  }
}

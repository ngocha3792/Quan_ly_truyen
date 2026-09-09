import { DestroyRef, inject, Injectable } from '@angular/core';
import { ChapterRecoveryEntry, ChapterRecoveryScope } from '../domain/chapter-editing.models';

export function chapterRecoveryKey(scope: ChapterRecoveryScope): string {
  return JSON.stringify([scope.accountId, scope.storyId, scope.chapterId ?? 'new', scope.tabId]);
}

@Injectable()
export class ChapterLocalRecoveryService {
  private readonly database = 'truyenhub-author-recovery';
  private readonly store = 'scoped-drafts';
  readonly tabId = crypto.randomUUID();
  private readonly channel =
    typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('truyenhub-author-recovery-tabs')
      : null;
  private readonly alive = new Set<string>();

  constructor() {
    if (this.channel)
      this.channel.onmessage = (event: MessageEvent<{ type: string; tabId: string }>) => {
        if (event.data?.type === 'probe')
          this.channel?.postMessage({ type: 'alive', tabId: this.tabId });
        if (event.data?.type === 'alive') this.alive.add(event.data.tabId);
      };
    inject(DestroyRef).onDestroy(() => this.channel?.close());
  }

  async save(entry: ChapterRecoveryEntry): Promise<void> {
    const db = await this.open();
    if (db) await this.transaction(db, (store) => store.put(entry));
  }

  async list(scope: ChapterRecoveryScope): Promise<readonly ChapterRecoveryEntry[]> {
    const db = await this.open();
    if (!db) return [];
    const entries = await this.transaction<ChapterRecoveryEntry[]>(
      db,
      (store) => store.getAll(),
      'readonly',
    );
    if (this.channel) {
      this.alive.clear();
      this.channel.postMessage({ type: 'probe', tabId: this.tabId });
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return (entries ?? [])
      .filter(
        (entry) =>
          entry.accountId === scope.accountId &&
          entry.storyId === scope.storyId &&
          entry.chapterId === scope.chapterId &&
          !this.alive.has(entry.tabId),
      )
      .sort((a, b) => b.savedAt - a.savedAt);
  }

  /** Delete only the acknowledged revision, never edits typed during a server request. */
  async clearIfRevision(key: string, revision: number): Promise<void> {
    const db = await this.open();
    if (!db) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.store, 'readwrite');
      const store = tx.objectStore(this.store);
      const get = store.get(key);
      get.onsuccess = () => {
        const entry = get.result as ChapterRecoveryEntry | undefined;
        if (entry?.revision === revision) store.delete(key);
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  private open(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.database, 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(this.store))
          request.result.createObjectStore(this.store, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error('Hãy đóng tab soạn thảo cũ để bật khôi phục bản nháp.'));
    });
  }

  private transaction<T = unknown>(
    db: IDBDatabase,
    action: (store: IDBObjectStore) => IDBRequest<T>,
    mode: IDBTransactionMode = 'readwrite',
  ): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.store, mode);
      const request = action(tx.objectStore(this.store));
      tx.oncomplete = () => {
        db.close();
        resolve(request.result);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    });
  }
}

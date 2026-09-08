import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { OfflineDbService } from './offline-db.service';
import type { OfflinePackageRecord } from './offline.models';

describe('OfflineDbService package cleanup transaction', () => {
  it('deletes the package, all scoped chapters and media in one readwrite transaction', async () => {
    vi.stubGlobal('indexedDB', {});
    vi.stubGlobal('IDBKeyRange', { only: (value: IDBValidKey) => value });
    const deleted: Array<{ store: string; key: IDBValidKey }> = [];
    const indexReads: Array<{ store: string; key: IDBValidKey }> = [];
    const storedPackage = { ...packageRecord(), scopeKey: 'user-1:session-1' };
    const chapters = [
      { scopeKey: storedPackage.scopeKey, packageId: storedPackage.id, chapterId: 'chapter-1' },
      { scopeKey: storedPackage.scopeKey, packageId: storedPackage.id, chapterId: 'chapter-2' },
    ];
    const media = [
      { scopeKey: storedPackage.scopeKey, packageId: storedPackage.id, id: 'media-1' },
      { scopeKey: storedPackage.scopeKey, packageId: storedPackage.id, id: 'media-2' },
    ];
    const transaction = new FakeTransaction({
      packages: new FakeStore('packages', deleted, () => storedPackage),
      chapters: new FakeStore('chapters', deleted, (key) => {
        indexReads.push({ store: 'chapters', key });
        return chapters;
      }),
      media: new FakeStore('media', deleted, (key) => {
        indexReads.push({ store: 'media', key });
        return media;
      }),
    });
    const database = {
      transaction: vi.fn(() => transaction as unknown as IDBTransaction),
    } as unknown as IDBDatabase;

    TestBed.configureTestingModule({
      providers: [OfflineDbService, { provide: PLATFORM_ID, useValue: 'browser' }],
    });
    const service = TestBed.inject(OfflineDbService);
    const internals = service as unknown as {
      activeScopeState: ReturnType<typeof signal>;
      databasePromise: Promise<IDBDatabase>;
    };
    internals.activeScopeState.set({ userId: 'user-1', sessionId: 'session-1' });
    internals.databasePromise = Promise.resolve(database);

    await expect(service.deletePackage('package-1')).resolves.toMatchObject({ id: 'package-1' });
    expect(database.transaction).toHaveBeenCalledWith(
      ['packages', 'chapters', 'media'],
      'readwrite',
    );
    expect(indexReads).toEqual([
      { store: 'chapters', key: ['user-1:session-1', 'package-1'] },
      { store: 'media', key: ['user-1:session-1', 'package-1'] },
    ]);
    expect(deleted).toEqual([
      { store: 'packages', key: ['user-1:session-1', 'package-1'] },
      { store: 'chapters', key: ['user-1:session-1', 'package-1', 'chapter-1'] },
      { store: 'chapters', key: ['user-1:session-1', 'package-1', 'chapter-2'] },
      { store: 'media', key: ['user-1:session-1', 'package-1', 'media-1'] },
      { store: 'media', key: ['user-1:session-1', 'package-1', 'media-2'] },
    ]);
  });
});

class FakeTransaction {
  readonly error = null;
  private readonly listeners = new Map<string, EventListener[]>();

  constructor(private readonly stores: Readonly<Record<string, FakeStore>>) {
    window.setTimeout(() => this.emit('complete'), 0);
  }

  objectStore(name: string): IDBObjectStore {
    const store = this.stores[name];
    if (!store) throw new Error(`Unexpected store ${name}`);
    return store as unknown as IDBObjectStore;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== 'function') return;
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  private emit(type: string): void {
    this.listeners.get(type)?.forEach((listener) => listener(new Event(type)));
  }
}

class FakeStore {
  constructor(
    private readonly name: string,
    private readonly deleted: Array<{ store: string; key: IDBValidKey }>,
    private readonly read: (key: IDBValidKey) => unknown,
  ) {}

  get(key: IDBValidKey): IDBRequest<unknown> {
    return new FakeRequest(this.read(key)) as unknown as IDBRequest<unknown>;
  }

  index(): IDBIndex {
    return {
      getAll: (key: IDBValidKey) => new FakeRequest(this.read(key)),
    } as unknown as IDBIndex;
  }

  delete(key: IDBValidKey): IDBRequest<undefined> {
    this.deleted.push({ store: this.name, key });
    return new FakeRequest(undefined) as unknown as IDBRequest<undefined>;
  }
}

class FakeRequest<T> {
  readonly error = null;

  constructor(readonly result: T) {}

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type !== 'success' || typeof listener !== 'function') return;
    queueMicrotask(() => listener(new Event('success')));
  }
}

function packageRecord(): OfflinePackageRecord {
  return {
    id: 'package-1',
    name: 'Package 1',
    description: null,
    status: 'READY',
    downloadState: 'READY',
    licenseExpiresAt: '2026-10-01T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    chapterIds: ['chapter-1', 'chapter-2'],
    assetUrls: ['https://cdn.example.com/media-1.webp'],
    chapterCount: 2,
    totalSizeBytes: 100,
    downloadedBytes: 100,
    downloadedAt: '2026-09-01T00:00:00.000Z',
    lastAccessedAt: '2026-09-08T00:00:00.000Z',
    reservationId: null,
    reservationExpiresAt: null,
  };
}

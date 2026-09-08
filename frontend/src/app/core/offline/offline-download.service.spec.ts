import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import { ServiceWorkerRegistrationService } from '../pwa/service-worker-registration.service';
import { OfflineDbService } from './offline-db.service';
import { OfflineDownloadService } from './offline-download.service';
import { OfflineLibraryService } from './offline-library.service';
import type { OfflinePackageRecord, OfflineStorageScope } from './offline.models';

describe('OfflineDownloadService', () => {
  const activeScope = signal<OfflineStorageScope | null>({
    userId: 'user-1',
    sessionId: 'session-1',
  });
  const database = {
    activeScope: activeScope.asReadonly(),
    getPackage: vi.fn(async () => null),
    reservePackage: vi.fn(async () => ({
      removedPackageIds: [],
      removedAssetUrls: [],
      freedBytes: 0,
    })),
    saveReservedMedia: vi.fn(async () => undefined),
    saveReservedChapter: vi.fn(async () => undefined),
    markPackageReady: vi.fn(async (_id: string, bytes: number) => readyRecord(bytes)),
    deleteReservedPackage: vi.fn(async () => null),
  };
  const serviceWorker = {
    cacheManifestAssets: vi.fn(async () => 1),
    removeManifestAssets: vi.fn(async () => 1),
  };
  const library = {
    deletePackage: vi.fn(),
    isDownloaded: vi.fn(),
    listPackages: vi.fn(),
    getChapter: vi.fn(),
    getPackageEntry: vi.fn(),
    cleanup: vi.fn(),
  };
  let httpGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    activeScope.set({ userId: 'user-1', sessionId: 'session-1' });
    vi.clearAllMocks();
    database.getPackage.mockResolvedValue(null);
    database.saveReservedMedia.mockResolvedValue(undefined);
    httpGet = vi.fn(() => of({ success: true, data: manifest() }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob(['image']), { status: 200 })),
    );
    TestBed.configureTestingModule({
      providers: [
        OfflineDownloadService,
        { provide: OfflineDbService, useValue: database },
        { provide: ServiceWorkerRegistrationService, useValue: serviceWorker },
        { provide: OfflineLibraryService, useValue: library },
        { provide: HttpClient, useValue: { get: httpGet } },
        { provide: APP_RUNTIME_CONFIG, useValue: runtimeConfig() },
      ],
    });
  });

  it('stages explicit assets, imports them to IDB, rechecks manifest, then purges cache', async () => {
    const reported: number[] = [];
    const result = await TestBed.inject(OfflineDownloadService).downloadPackage('package-1', {
      onProgress: (value) => reported.push(value.percent),
    });

    expect(result.downloadState).toBe('READY');
    expect(httpGet).toHaveBeenCalledTimes(2);
    expect(serviceWorker.cacheManifestAssets).toHaveBeenCalledWith([
      'https://cdn.example.com/slice.webp',
    ]);
    expect(database.saveReservedMedia).toHaveBeenCalledTimes(1);
    expect(serviceWorker.removeManifestAssets).toHaveBeenCalledWith([
      'https://cdn.example.com/slice.webp',
    ]);
    expect(serviceWorker.removeManifestAssets.mock.invocationCallOrder[0]).toBeLessThan(
      database.markPackageReady.mock.invocationCallOrder[0],
    );
    expect(reported.at(-1)).toBe(100);
  });

  it('rejects an old-account manifest before any write after an account switch', async () => {
    const response = new Subject<{ success: true; data: unknown }>();
    httpGet.mockReturnValue(response.asObservable());
    const download = TestBed.inject(OfflineDownloadService).downloadPackage('package-1');

    activeScope.set({ userId: 'user-2', sessionId: 'session-2' });
    response.next({ success: true, data: manifest() });
    response.complete();

    await expect(download).rejects.toThrowError(/Phiên đã đổi/);
    expect(database.reservePackage).not.toHaveBeenCalled();
    expect(serviceWorker.cacheManifestAssets).not.toHaveBeenCalled();
  });

  it('purges staged cache before deleting its own failed reservation', async () => {
    database.saveReservedMedia.mockRejectedValueOnce(new Error('quota write failed'));

    await expect(
      TestBed.inject(OfflineDownloadService).downloadPackage('package-1'),
    ).rejects.toThrowError(/quota write failed/);
    expect(serviceWorker.removeManifestAssets.mock.invocationCallOrder[0]).toBeLessThan(
      database.deleteReservedPackage.mock.invocationCallOrder[0],
    );
  });
});

function manifest() {
  return {
    packageId: 'package-1',
    name: 'Package 1',
    description: null,
    status: 'READY',
    licenseExpiresAt: '2099-10-01T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    totalSizeBytes: '1000',
    chapterCount: 1,
    chapters: [
      {
        chapterId: 'chapter-1',
        story: { id: 'story-1', slug: 'story-1', title: 'Story 1' },
        number: 1,
        title: 'Chapter 1',
        slug: 'chapter-1',
        chapterVersion: 1,
        content: 'Content',
        contentFormat: 'rich_text',
        contentDocument: {
          schemaVersion: 1,
          blocks: [{ id: 'block-1', type: 'paragraph', text: 'Content', marks: [] }],
        },
        documentSchemaVersion: 1,
        access: { type: 'FREE', state: 'FREE', priceCredits: null, entitlementId: null },
        media: [
          {
            mediaAssetId: 'media-1',
            sortOrder: 0,
            altText: null,
            caption: null,
            width: 100,
            height: 200,
            slices: [
              {
                id: 'slice-1',
                sliceIndex: 0,
                width: 100,
                height: 200,
                offsetY: 0,
                aspectRatio: 0.5,
                urls: {
                  avif: 'https://cdn.example.com/slice.avif',
                  webp: 'https://cdn.example.com/slice.webp',
                  jpeg: 'https://cdn.example.com/slice.jpg',
                },
              },
            ],
          },
        ],
        wordCount: 1,
        publishedAt: '2026-09-01T00:00:00.000Z',
        snapshotAt: '2026-09-08T00:00:00.000Z',
      },
    ],
  };
}

function readyRecord(downloadedBytes: number): OfflinePackageRecord {
  return {
    id: 'package-1',
    name: 'Package 1',
    description: null,
    status: 'READY',
    downloadState: 'READY',
    licenseExpiresAt: '2099-10-01T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    chapterIds: ['chapter-1'],
    assetUrls: ['https://cdn.example.com/slice.webp'],
    chapterCount: 1,
    totalSizeBytes: 1000,
    downloadedBytes,
    downloadedAt: '2026-09-08T00:00:00.000Z',
    lastAccessedAt: '2026-09-08T00:00:00.000Z',
    reservationId: null,
    reservationExpiresAt: null,
  };
}

function runtimeConfig() {
  return {
    apiBaseUrl: '/api/v1',
    production: false,
    features: { offlineReadingEnabled: true },
  };
}

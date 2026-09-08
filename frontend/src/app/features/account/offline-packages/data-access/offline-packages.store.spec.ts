import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { OfflineDbService } from '../../../../core/offline/offline-db.service';
import { OfflineDownloadService } from '../../../../core/offline/offline-download.service';
import type { OfflinePackageRecord } from '../../../../core/offline/offline.models';
import { OfflinePackagesRepository } from '../domain/offline-packages.repository';
import { OfflinePackagesStore } from './offline-packages.store';

describe('OfflinePackagesStore local fallback', () => {
  it('shows and opens a downloaded package without loading the server', async () => {
    const repository = {
      listPackages: vi.fn(),
      getQuota: vi.fn(),
      createPackage: vi.fn(),
      deletePackage: vi.fn(),
      touchPackage: vi.fn(),
      listSourceStories: vi.fn(),
      listStoryChapters: vi.fn(),
    };
    const database = {
      estimateStorage: vi.fn(() =>
        Promise.resolve({
          usageBytes: 40,
          quotaBytes: 1_000,
          offlineBytes: 40,
          offlineBudgetBytes: 700,
        }),
      ),
    };
    const downloader = {
      listLocalPackages: vi.fn(() => Promise.resolve([localPackage()])),
      getPackageEntry: vi.fn(() =>
        Promise.resolve({ storySlug: 'truyen-offline', chapterNumber: 4 }),
      ),
      deletePackage: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        OfflinePackagesStore,
        { provide: OfflinePackagesRepository, useValue: repository },
        { provide: OfflineDbService, useValue: database },
        { provide: OfflineDownloadService, useValue: downloader },
      ],
    });
    const store = TestBed.inject(OfflinePackagesStore);

    store.loadLocalData();

    await vi.waitFor(() => expect(store.packages().map((item) => item.id)).toEqual(['local-1']));
    await expect(store.getPackageEntryRoute('local-1')).resolves.toEqual({
      storySlug: 'truyen-offline',
      chapterNumber: 4,
    });
    expect(repository.listPackages).not.toHaveBeenCalled();
  });
});

function localPackage(): OfflinePackageRecord {
  return {
    id: 'local-1',
    name: 'Gói trên máy',
    description: null,
    status: 'READY',
    downloadState: 'READY',
    reservationId: null,
    reservationExpiresAt: null,
    licenseExpiresAt: '2026-10-08T00:00:00.000Z',
    createdAt: '2026-09-08T00:00:00.000Z',
    chapterIds: ['chapter-4'],
    assetUrls: [],
    chapterCount: 1,
    totalSizeBytes: 40,
    downloadedBytes: 40,
    downloadedAt: '2026-09-08T00:00:00.000Z',
    lastAccessedAt: '2026-09-08T00:00:00.000Z',
  };
}

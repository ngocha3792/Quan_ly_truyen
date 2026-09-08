import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it, vi } from 'vitest';

import type { OfflineChapterBundle } from '../../../../core/offline/offline.models';
import { mapOfflineChapterBundle, shouldTryOfflineChapter } from './chapter-reader-offline.adapter';

describe('chapter reader offline adapter', () => {
  it('only falls back for offline/network failures', () => {
    expect(shouldTryOfflineChapter(new HttpErrorResponse({ status: 0 }), true)).toBe(true);
    expect(shouldTryOfflineChapter(new HttpErrorResponse({ status: 403 }), true)).toBe(false);
    expect(shouldTryOfflineChapter(new HttpErrorResponse({ status: 403 }), false)).toBe(false);
    expect(shouldTryOfflineChapter(new HttpErrorResponse({ status: 500 }), true)).toBe(false);
    expect(shouldTryOfflineChapter(new Error('offline'), false)).toBe(true);
  });

  it('maps a valid local snapshot without changing its entitlement state', () => {
    const createObjectUrl = vi.fn(() => 'blob:offline-slice');
    const result = mapOfflineChapterBundle(bundle(), createObjectUrl);

    expect(result.packageName).toBe('Gói thử');
    expect(result.view.chapter.accessState).toBe('ENTITLED');
    expect(result.view.chapter.blocks).toEqual([
      { id: 'block-1', type: 'paragraph', text: 'Nội dung offline' },
    ]);
    expect(result.view.chapter.media[0].slices[0].urls.webp).toBe('blob:offline-slice');
    expect(result.view.navigation.next?.url).toBe('/truyen/truyen-thu/chuong/3');
  });
});

function bundle(): OfflineChapterBundle {
  const blob = new Blob(['image'], { type: 'image/webp' });
  return {
    package: {
      id: 'package-1',
      name: 'Gói thử',
      description: null,
      status: 'READY',
      downloadState: 'READY',
      reservationId: null,
      reservationExpiresAt: null,
      licenseExpiresAt: '2026-10-08T00:00:00.000Z',
      createdAt: '2026-09-08T00:00:00.000Z',
      chapterIds: ['chapter-2'],
      assetUrls: [],
      chapterCount: 1,
      totalSizeBytes: blob.size,
      downloadedBytes: blob.size,
      downloadedAt: '2026-09-08T00:00:00.000Z',
      lastAccessedAt: '2026-09-08T00:00:00.000Z',
    },
    chapter: {
      packageId: 'package-1',
      chapterId: 'chapter-2',
      story: { id: 'story-1', slug: 'truyen-thu', title: 'Truyện thử' },
      number: 2,
      title: 'Chương hai',
      slug: 'chuong-hai',
      version: 3,
      content: 'Nội dung offline',
      contentFormat: 'DOCUMENT_V1',
      contentDocument: {
        schemaVersion: 1,
        blocks: [
          {
            id: 'block-1',
            type: 'paragraph',
            text: 'Nội dung offline',
            marks: [],
          },
        ],
      },
      documentSchemaVersion: 1,
      access: {
        type: 'PAID',
        state: 'ENTITLED',
        priceCredits: '5',
        entitlementId: 'entitlement-1',
      },
      media: [
        {
          mediaAssetId: 'media-1',
          sortOrder: 0,
          altText: null,
          caption: null,
          width: 800,
          height: 1200,
          slices: [
            {
              id: 'slice-1',
              mediaStorageId: 'media-1:slice-1',
              sliceIndex: 0,
              width: 800,
              height: 1200,
              offsetY: 0,
              aspectRatio: 2 / 3,
            },
          ],
        },
      ],
      wordCount: 10,
      publishedAt: '2026-09-01T00:00:00.000Z',
      snapshotAt: '2026-09-08T00:00:00.000Z',
    },
    media: [
      {
        id: 'media-1:slice-1',
        packageId: 'package-1',
        chapterId: 'chapter-2',
        mediaAssetId: 'media-1',
        sliceId: 'slice-1',
        originalUrl: 'https://cdn.example/slice.webp',
        mimeType: 'image/webp',
        width: 800,
        height: 1200,
        sizeBytes: blob.size,
        blob,
      },
    ],
    navigation: {
      previous: { number: 1, title: 'Chương một', storySlug: 'truyen-thu' },
      next: { number: 3, title: 'Chương ba', storySlug: 'truyen-thu' },
    },
  };
}

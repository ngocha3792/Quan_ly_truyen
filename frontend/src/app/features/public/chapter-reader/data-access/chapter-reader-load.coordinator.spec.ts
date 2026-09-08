import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthSessionLifecycleEvent } from '../../../../core/auth/auth-session-lifecycle.service';
import { AuthSessionLifecycleService } from '../../../../core/auth/auth-session-lifecycle.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { OfflineConnectivityService } from '../../../../core/offline/offline-connectivity.service';
import { OfflineDbService } from '../../../../core/offline/offline-db.service';
import type { ChapterReaderView } from '../domain/chapter-reader.models';
import type { OfflineChapterReaderResult } from './chapter-reader-offline.adapter';
import { ChapterReaderOfflineAdapter } from './chapter-reader-offline.adapter';
import { ChapterReaderLoadCoordinator } from './chapter-reader-load.coordinator';
import { ChapterReaderRepository } from './chapter-reader.repository';
import { ChapterReaderSourceService } from './chapter-reader-source.service';
import { ReadingProgressSyncService } from './reading-progress-sync.service';

describe('ChapterReaderLoadCoordinator offline lifecycle', () => {
  afterEach(() => TestBed.resetTestingModule());

  it.each([
    {
      label: 'remote logout after load',
      pending: false,
      event: {
        kind: 'session-cleared',
        scope: null,
        reason: 'remote-logout',
        remote: true,
        revision: 2,
      } satisfies AuthSessionLifecycleEvent,
    },
    {
      label: 'account switch after load',
      pending: false,
      event: {
        kind: 'session-established',
        scope: { userId: 'user-2', sessionId: 'session-2' },
        reason: 'session-established',
        remote: false,
        revision: 2,
      } satisfies AuthSessionLifecycleEvent,
    },
    {
      label: 'remote logout during load',
      pending: true,
      event: {
        kind: 'session-cleared',
        scope: null,
        reason: 'remote-logout',
        remote: true,
        revision: 2,
      } satisfies AuthSessionLifecycleEvent,
    },
    {
      label: 'account switch during load',
      pending: true,
      event: {
        kind: 'session-established',
        scope: { userId: 'user-2', sessionId: 'session-2' },
        reason: 'session-established',
        remote: false,
        revision: 2,
      } satisfies AuthSessionLifecycleEvent,
    },
  ])('clears the rendered offline view and Blob assets on $label', ({ event, pending }) => {
    const lifecycleEvents = new Subject<AuthSessionLifecycleEvent>();
    const pendingOfflineResult = new Subject<OfflineChapterReaderResult | null>();
    const offlineReader = {
      getChapter: vi.fn(() => (pending ? pendingOfflineResult : of(offlineResult()))),
      releaseAssets: vi.fn(),
      adoptAssets: vi.fn(),
      discardAssets: vi.fn(),
    };
    const progress = {
      flush: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        ChapterReaderSourceService,
        ChapterReaderLoadCoordinator,
        {
          provide: ChapterReaderRepository,
          useValue: {
            getChapter: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 0 }))),
            getComments: vi.fn(() => of({ items: [], total: 0 })),
          },
        },
        { provide: ChapterReaderOfflineAdapter, useValue: offlineReader },
        {
          provide: OfflineConnectivityService,
          useValue: { online: () => false, initialize: vi.fn() },
        },
        {
          provide: OfflineDbService,
          useValue: { activeScope: () => ({ userId: 'user-1', sessionId: 'session-1' }) },
        },
        {
          provide: AuthSessionLifecycleService,
          useValue: { changes$: lifecycleEvents.asObservable(), scope: () => null },
        },
        { provide: AuthStore, useValue: { ensureInitialized: vi.fn() } },
        {
          provide: APP_RUNTIME_CONFIG,
          useValue: { features: { realtimeProgressSyncEnabled: true } },
        },
        { provide: ReadingProgressSyncService, useValue: progress },
      ],
    });
    const coordinator = TestBed.inject(ChapterReaderLoadCoordinator);
    const view = signal<ChapterReaderView | null>(null);
    const loading = signal(false);
    const error = signal<string | null>(null);
    const bookmarked = signal(false);

    coordinator.load('truyen-thu', '2', { view, loading, error, bookmarked });
    expect(view()?.chapter.id ?? null).toBe(pending ? null : 'chapter-2');

    lifecycleEvents.next(event);
    if (pending) {
      pendingOfflineResult.next(offlineResult());
      pendingOfflineResult.complete();
    }

    expect(view()).toBeNull();
    expect(error()).toMatch(/phiên|Phiên/u);
    expect(progress.stop).toHaveBeenCalledOnce();
    expect(offlineReader.releaseAssets).toHaveBeenCalledTimes(2);
    expect(offlineReader.adoptAssets).toHaveBeenCalledTimes(pending ? 0 : 1);
    expect(offlineReader.discardAssets).toHaveBeenCalledTimes(pending ? 1 : 0);
  });
});

function offlineResult(): OfflineChapterReaderResult {
  return {
    packageId: 'package-1',
    packageName: 'Gói thử',
    licenseExpiresAt: '2026-10-08T00:00:00.000Z',
    view: {
      story: { id: 'story-1', slug: 'truyen-thu', title: 'Truyện thử' },
      chapter: {
        id: 'chapter-2',
        number: 2,
        title: 'Chương hai',
        paragraphs: ['Nội dung'],
        blocks: [{ id: 'block-1', type: 'paragraph', text: 'Nội dung' }],
        publishedAt: '2026-09-01T00:00:00.000Z',
        views: 0,
        accessState: 'ENTITLED',
        priceCredits: '5',
        media: [],
      },
      navigation: { previous: null, next: null },
      comments: [],
      totalComments: 0,
    },
  };
}

import { TestBed } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthStore } from '../../../../core/auth/auth.store';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import type { ChapterReaderView } from '../domain/chapter-reader.models';
import { ChapterReaderRepository } from './chapter-reader.repository';
import { ChapterReaderLoadCoordinator } from './chapter-reader-load.coordinator';
import { ChapterReaderSourceService } from './chapter-reader-source.service';
import { ChapterReaderStore } from './chapter-reader.store';
import { ReadingProgressSyncService } from './reading-progress-sync.service';

describe('ChapterReaderStore bookmark hydration', () => {
  const repository = {
    getChapter: vi.fn(),
    getComments: vi.fn(),
    saveProgress: vi.fn(),
    getBookmark: vi.fn(),
  };
  const chapterSource = {
    getChapter: vi.fn(),
    offlineInfo: () => null,
    offlineMode: () => false,
    invalidated$: NEVER,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository.getChapter.mockReturnValue(of(chapterView()));
    repository.getComments.mockReturnValue(of({ items: [], total: 0 }));
    repository.saveProgress.mockReturnValue(of(undefined));
    repository.getBookmark.mockReturnValue(of(true));
    chapterSource.getChapter.mockReturnValue(of(chapterView()));

    TestBed.configureTestingModule({
      providers: [
        ChapterReaderStore,
        ChapterReaderLoadCoordinator,
        { provide: ChapterReaderRepository, useValue: repository },
        {
          provide: AuthStore,
          useValue: {
            ensureInitialized: () => of('authenticated' as const),
            isAuthenticated: () => true,
          },
        },
        {
          provide: APP_RUNTIME_CONFIG,
          useValue: { features: { realtimeProgressSyncEnabled: false } },
        },
        {
          provide: ReadingProgressSyncService,
          useValue: {
            start: vi.fn(),
            stop: vi.fn(),
            capture: vi.fn(),
            flush: vi.fn(),
          },
        },
        { provide: ChapterReaderSourceService, useValue: chapterSource },
      ],
    });
  });

  it('reloads bookmark state from the API instead of keeping local state', () => {
    const store = TestBed.inject(ChapterReaderStore);

    store.load('story-one', '1');
    expect(store.bookmarked()).toBe(true);
    expect(repository.getBookmark).toHaveBeenCalledWith('chapter-1');

    repository.getBookmark.mockReturnValue(of(false));
    store.load('story-one', '1');

    expect(store.bookmarked()).toBe(false);
    expect(repository.getBookmark).toHaveBeenCalledTimes(2);
  });

  it('keeps an online LOCKED response and never replaces it with local content', () => {
    chapterSource.getChapter.mockReturnValue(
      of({
        ...chapterView(),
        chapter: {
          ...chapterView().chapter,
          accessState: 'LOCKED' as const,
          priceCredits: '5',
        },
      }),
    );
    const store = TestBed.inject(ChapterReaderStore);

    store.load('story-one', '1');

    expect(store.view()?.chapter.accessState).toBe('LOCKED');
    expect(store.offlineMode()).toBe(false);
  });
});

function chapterView(): ChapterReaderView {
  return {
    story: {
      id: 'story-1',
      slug: 'story-one',
      title: 'Story One',
    },
    chapter: {
      id: 'chapter-1',
      number: 1,
      title: 'Chapter One',
      paragraphs: ['Content'],
      blocks: [{ id: null, type: 'paragraph', text: 'Content' }],
      accessState: 'FREE',
      priceCredits: null,
      media: [],
      publishedAt: '2026-08-17T00:00:00.000Z',
      views: 1,
    },
    navigation: { previous: null, next: null },
    comments: [],
    totalComments: 0,
  };
}

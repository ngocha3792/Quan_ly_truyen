import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthStore } from '../../../../core/auth/auth.store';
import type { ChapterReaderView } from '../domain/chapter-reader.models';
import { ChapterReaderRepository } from './chapter-reader.repository';
import { ChapterReaderStore } from './chapter-reader.store';

describe('ChapterReaderStore bookmark hydration', () => {
  const repository = {
    getChapter: vi.fn(),
    getComments: vi.fn(),
    saveProgress: vi.fn(),
    getBookmark: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository.getChapter.mockReturnValue(of(chapterView()));
    repository.getComments.mockReturnValue(of({ items: [], total: 0 }));
    repository.saveProgress.mockReturnValue(of(undefined));
    repository.getBookmark.mockReturnValue(of(true));

    TestBed.configureTestingModule({
      providers: [
        ChapterReaderStore,
        { provide: ChapterReaderRepository, useValue: repository },
        {
          provide: AuthStore,
          useValue: {
            ensureInitialized: () => of('authenticated' as const),
            isAuthenticated: () => true,
          },
        },
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
      publishedAt: '2026-08-17T00:00:00.000Z',
      views: 1,
    },
    navigation: { previous: null, next: null },
    comments: [],
    totalComments: 0,
  };
}

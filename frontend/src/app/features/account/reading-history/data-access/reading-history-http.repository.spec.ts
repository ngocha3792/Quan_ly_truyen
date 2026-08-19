import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ReadingHistoryHttpRepository } from './reading-history-http.repository';

describe('ReadingHistoryHttpRepository', () => {
  let repository: ReadingHistoryHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ReadingHistoryHttpRepository,
        {
          provide: APP_RUNTIME_CONFIG,
          useValue: {
            apiBaseUrl: '/api/v1',
            appName: 'TruyenHub',
            production: false,
          },
        },
      ],
    });

    repository = TestBed.inject(ReadingHistoryHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('hydrates persisted bookmark state together with reading history', async () => {
    const resultPromise = firstValueFrom(repository.getHistory());

    const historyRequest = http.expectOne('/api/v1/reading-history');
    const bookmarksRequest = http.expectOne('/api/v1/reading-bookmarks');
    expect(historyRequest.request.method).toBe('GET');
    expect(bookmarksRequest.request.method).toBe('GET');

    historyRequest.flush(
      successEnvelope([
        {
          story: {
            id: 'story-1',
            slug: 'story-one',
            title: 'Story One',
            author: 'Pen Name',
            coverUrl: null,
            categories: ['Fantasy'],
            latestChapterNumber: 3,
            chapterCount: 3,
          },
          currentChapter: {
            id: 'chapter-2',
            number: 2,
            title: 'Second chapter',
          },
          position: 0,
          progressPercent: 66.67,
          lastReadAt: '2026-08-17T08:00:00.000Z',
        },
      ]),
    );
    bookmarksRequest.flush(
      successEnvelope([
        {
          id: 'bookmark-1',
          storyId: 'story-1',
          chapterId: 'chapter-2',
          position: 0,
          createdAt: '2026-08-17T08:01:00.000Z',
          updatedAt: '2026-08-17T08:01:00.000Z',
        },
      ]),
    );

    const result = await resultPromise;
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toMatchObject({
      id: 'story-1',
      chapterId: 'chapter-2',
      chapterNumber: 2,
      bookmarked: true,
    });
  });
});

function successEnvelope<T>(data: T) {
  return {
    success: true as const,
    data,
    requestId: 'bookmark-test-request',
    timestamp: '2026-08-17T08:00:00.000Z',
  };
}

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import { ReaderEngagementApiClient } from './reader-engagement-api.client';
import type { StoryCommentApiItem } from './reader-engagement-api.model';

describe('ReaderEngagementApiClient', () => {
  let api: ReaderEngagementApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
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

    api = TestBed.inject(ReaderEngagementApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('unwraps the library success envelope', async () => {
    const promise = firstValueFrom(api.listLibrary());
    const request = http.expectOne('/api/v1/library');
    expect(request.request.method).toBe('GET');
    request.flush(successEnvelope([]));
    await expect(promise).resolves.toEqual([]);
  });

  it('uses persisted reading-bookmark endpoints', async () => {
    const bookmark = {
      id: 'bookmark-1',
      storyId: 'story-1',
      chapterId: 'chapter-1',
      position: 0,
      createdAt: '2026-08-17T00:00:00.000Z',
      updatedAt: '2026-08-17T00:00:00.000Z',
    };

    const savePromise = firstValueFrom(api.upsertReadingBookmark('chapter-1'));
    const saveRequest = http.expectOne('/api/v1/reading-bookmarks/chapter-1');
    expect(saveRequest.request.method).toBe('PUT');
    expect(saveRequest.request.body).toEqual({});
    saveRequest.flush(successEnvelope(bookmark));
    await expect(savePromise).resolves.toEqual(bookmark);

    const getPromise = firstValueFrom(api.getReadingBookmark('chapter-1'));
    const getRequest = http.expectOne('/api/v1/reading-bookmarks/chapter-1');
    expect(getRequest.request.method).toBe('GET');
    getRequest.flush(successEnvelope(bookmark));
    await expect(getPromise).resolves.toEqual(bookmark);

    const listPromise = firstValueFrom(api.listReadingBookmarks());
    const listRequest = http.expectOne('/api/v1/reading-bookmarks');
    expect(listRequest.request.method).toBe('GET');
    listRequest.flush(successEnvelope([bookmark]));
    await expect(listPromise).resolves.toEqual([bookmark]);

    const removePromise = firstValueFrom(api.removeReadingBookmark('chapter-1'));
    const removeRequest = http.expectOne('/api/v1/reading-bookmarks/chapter-1');
    expect(removeRequest.request.method).toBe('DELETE');
    removeRequest.flush(null);
    await expect(removePromise).resolves.toBeNull();
  });

  it('reuses a comment idempotency key after an ambiguous failure', async () => {
    const first = firstValueFrom(api.createStoryComment('story-1', '  Xin chào  '));
    const firstRequest = http.expectOne('/api/v1/stories/story-1/comments');
    const firstKey = firstRequest.request.headers.get('x-idempotency-key');
    expect(firstKey).toBeTruthy();
    expect(firstRequest.request.body).toEqual({ body: 'Xin chào' });
    firstRequest.error(new ProgressEvent('network-error'));
    await expect(first).rejects.toBeTruthy();

    const second = firstValueFrom(api.createStoryComment('story-1', 'Xin chào'));
    const secondRequest = http.expectOne('/api/v1/stories/story-1/comments');
    expect(secondRequest.request.headers.get('x-idempotency-key')).toBe(firstKey);
    secondRequest.flush(successEnvelope(comment('comment-1')));
    await expect(second).resolves.toMatchObject({ id: 'comment-1' });

    const third = firstValueFrom(api.createStoryComment('story-1', 'Xin chào'));
    const thirdRequest = http.expectOne('/api/v1/stories/story-1/comments');
    expect(thirdRequest.request.headers.get('x-idempotency-key')).not.toBe(firstKey);
    thirdRequest.flush(successEnvelope(comment('comment-2')));
    await expect(third).resolves.toMatchObject({ id: 'comment-2' });
  });

  it('posts a text anchor with an idempotency key', async () => {
    const anchor = {
      startBlockId: '11111111-1111-4111-8111-111111111111',
      startOffset: 2,
      endBlockId: '11111111-1111-4111-8111-111111111111',
      endOffset: 20,
      quoteText: 'đoạn được lựa chọn',
    };
    const promise = firstValueFrom(
      api.createAnchoredChapterComment('story-1', 'chapter-1', '  Ý kiến  ', anchor),
    );
    const request = http.expectOne('/api/v1/stories/story-1/chapters/chapter-1/anchored-comments');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('x-idempotency-key')).toBeTruthy();
    expect(request.request.body).toEqual({ body: 'Ý kiến', anchor });
    request.flush(successEnvelope(comment('comment-anchor-1')));
    await expect(promise).resolves.toMatchObject({ id: 'comment-anchor-1' });
  });
});

function successEnvelope<T>(data: T) {
  return {
    success: true,
    data,
    requestId: 'request-test',
    timestamp: '2026-08-15T12:00:00.000Z',
  };
}

function comment(id: string): StoryCommentApiItem {
  return {
    id,
    storyId: 'story-1',
    chapterId: null,
    parentId: null,
    depth: 0,
    body: 'Xin chào',
    displayState: 'VISIBLE',
    user: {
      id: 'user-1',
      displayName: 'Reader',
      avatarUrl: null,
    },
    likeCount: 0,
    reactions: { LIKE: 0, LOVE: 0, LAUGH: 0, INSIGHTFUL: 0 },
    replyCount: 0,
    threadReplyCount: 0,
    editedAt: null,
    createdAt: '2026-08-15T12:00:00.000Z',
    updatedAt: '2026-08-15T12:00:00.000Z',
    anchor: null,
    region: null,
  };
}

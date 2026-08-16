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
  };
}

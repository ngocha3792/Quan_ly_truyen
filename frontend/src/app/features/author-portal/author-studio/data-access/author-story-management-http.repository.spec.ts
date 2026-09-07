import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { AuthorManagedChapter } from '../domain/author-story-management.models';
import { AuthorMediaUploadService } from './author-media-upload.service';
import { AuthorStoryManagementHttpRepository } from './author-story-management-http.repository';

describe('AuthorStoryManagementHttpRepository chapter scheduling', () => {
  let repository: AuthorStoryManagementHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthorStoryManagementHttpRepository,
        { provide: AuthorMediaUploadService, useValue: {} },
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

    repository = TestBed.inject(AuthorStoryManagementHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('uses PUT to create or replace a chapter schedule', async () => {
    const chapter = scheduledChapter();
    const resultPromise = firstValueFrom(
      repository.scheduleChapter(chapter.storyId, chapter.id, chapter.scheduledAt!),
    );
    const request = http.expectOne(
      `/api/v1/author/stories/${chapter.storyId}/chapters/${chapter.id}/schedule`,
    );

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ scheduledAt: chapter.scheduledAt });
    request.flush(successEnvelope(chapter));

    await expect(resultPromise).resolves.toEqual(chapter);
  });

  it('uses DELETE to cancel the schedule', async () => {
    const chapter = scheduledChapter();
    const draft = { ...chapter, status: 'DRAFT' as const, scheduledAt: null };
    const resultPromise = firstValueFrom(
      repository.cancelChapterSchedule(chapter.storyId, chapter.id),
    );
    const request = http.expectOne(
      `/api/v1/author/stories/${chapter.storyId}/chapters/${chapter.id}/schedule`,
    );

    expect(request.request.method).toBe('DELETE');
    request.flush(successEnvelope(draft));

    await expect(resultPromise).resolves.toEqual(draft);
  });
});

function successEnvelope<T>(data: T) {
  return {
    success: true as const,
    data,
    requestId: 'chapter-scheduling-test',
    timestamp: '2026-09-07T00:00:00.000Z',
  };
}

function scheduledChapter(): AuthorManagedChapter {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    storyId: '22222222-2222-4222-8222-222222222222',
    createdById: '11111111-1111-4111-8111-111111111111',
    updatedById: '11111111-1111-4111-8111-111111111111',
    number: 1,
    title: 'Chương 1',
    slug: 'chuong-1',
    content: 'Nội dung',
    contentFormat: 'MARKDOWN',
    status: 'SCHEDULED',
    wordCount: 2,
    version: 1,
    scheduledAt: '2026-09-08T02:00:00.000Z',
    publishedAt: null,
    createdAt: '2026-09-07T00:00:00.000Z',
    updatedAt: '2026-09-07T00:00:00.000Z',
  };
}

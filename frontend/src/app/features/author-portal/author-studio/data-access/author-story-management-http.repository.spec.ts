import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { AuthorManagedChapter } from '../domain/author-story-management.models';
import { AuthorChapterMonetizationHttpService } from './author-chapter-monetization-http.service';
import { AuthorMediaUploadService } from './author-media-upload.service';
import { AuthorChapterVersionHttpService } from './author-chapter-version-http.service';
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
        AuthorChapterVersionHttpService,
        AuthorChapterMonetizationHttpService,
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

  it('loads paginated chapter version summaries', async () => {
    const chapter = scheduledChapter();
    const page = {
      items: [versionSummary(chapter)],
      total: 1,
      page: 1,
      pageSize: 10,
    };
    const resultPromise = firstValueFrom(
      repository.listChapterVersions(chapter.storyId, chapter.id, 1, 10),
    );
    const request = http.expectOne(
      (candidate) =>
        candidate.url ===
          `/api/v1/author/stories/${chapter.storyId}/chapters/${chapter.id}/versions` &&
        candidate.params.get('page') === '1' &&
        candidate.params.get('pageSize') === '10',
    );

    expect(request.request.method).toBe('GET');
    request.flush(successEnvelope(page));
    await expect(resultPromise).resolves.toEqual(page);
  });

  it('loads one chapter version with its content', async () => {
    const chapter = scheduledChapter();
    const version = {
      ...versionSummary(chapter),
      content: chapter.content,
      contentFormat: 'MARKDOWN',
    };
    const resultPromise = firstValueFrom(
      repository.getChapterVersion(chapter.storyId, chapter.id, version.version),
    );
    const request = http.expectOne(
      `/api/v1/author/stories/${chapter.storyId}/chapters/${chapter.id}/versions/${version.version}`,
    );

    expect(request.request.method).toBe('GET');
    request.flush(successEnvelope(version));
    await expect(resultPromise).resolves.toEqual(version);
  });

  it('autosaves through its endpoint with the expected version', async () => {
    const chapter = scheduledChapter();
    const input = {
      title: chapter.title,
      content: chapter.content,
      expectedVersion: chapter.version,
    };
    const result = firstValueFrom(repository.autosaveChapter(chapter.storyId, chapter.id, input));
    const request = http.expectOne(
      `/api/v1/author/stories/${chapter.storyId}/chapters/${chapter.id}/autosave`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush(successEnvelope(chapter));
    await expect(result).resolves.toEqual(chapter);
  });

  it('opts into autosave history without changing the default filter', async () => {
    const chapter = scheduledChapter();
    const result = firstValueFrom(
      repository.listChapterVersions(chapter.storyId, chapter.id, 2, 10, true),
    );
    const request = http.expectOne(
      (candidate) =>
        candidate.url.endsWith('/versions') && candidate.params.get('includeAutosaves') === 'true',
    );
    request.flush(successEnvelope({ items: [], total: 0, page: 2, pageSize: 10 }));
    await result;
  });

  it('requests a server diff between two versions', async () => {
    const chapter = scheduledChapter();
    const result = firstValueFrom(
      repository.getChapterVersionDiff(chapter.storyId, chapter.id, 1, 4),
    );
    const request = http.expectOne(
      (candidate) =>
        candidate.url.endsWith('/versions/diff') &&
        candidate.params.get('from') === '1' &&
        candidate.params.get('to') === '4',
    );
    request.flush(
      successEnvelope({
        fromVersion: 1,
        toVersion: 4,
        changes: [],
        titleChanges: [],
        stats: { added: 0, removed: 0, unchanged: 0 },
      }),
    );
    await expect(result).resolves.toMatchObject({ fromVersion: 1, toVersion: 4 });
  });

  it('restores a version through an idempotent POST', async () => {
    const chapter = scheduledChapter();
    const restored = { ...chapter, status: 'DRAFT' as const, version: 2, scheduledAt: null };
    const resultPromise = firstValueFrom(
      repository.restoreChapterVersion(chapter.storyId, chapter.id, 1, chapter.version),
    );
    const request = http.expectOne(
      `/api/v1/author/stories/${chapter.storyId}/chapters/${chapter.id}/versions/1/restore`,
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('x-idempotency-key')).toBeTruthy();
    expect(request.request.body).toEqual({ expectedVersion: chapter.version });
    request.flush(successEnvelope(restored));
    await expect(resultPromise).resolves.toEqual(restored);
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

function versionSummary(chapter: AuthorManagedChapter) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    chapterId: chapter.id,
    createdById: chapter.updatedById,
    createdByDisplayName: 'Tác giả',
    version: chapter.version,
    title: chapter.title,
    wordCount: chapter.wordCount,
    changeSummary: 'Tạo bản nháp',
    createdAt: chapter.updatedAt,
  };
}

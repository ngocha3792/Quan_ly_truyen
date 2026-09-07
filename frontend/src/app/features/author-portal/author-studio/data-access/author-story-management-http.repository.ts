import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, tap } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import {
  AuthorChapterDraftInput,
  AuthorChapterVersion,
  AuthorChapterMonetization,
  AuthorChapterVersionPage,
  AuthorManagedChapter,
  AuthorManagedChapterSummary,
  AuthorManagedStory,
  AuthorStoryDraftInput,
  AuthorStoryContributor,
  AuthorStoryContributorInput,
  AuthorStoryContributorRole,
  AuthorStoryMedia,
  AuthorStoryMetadataCategory,
  AuthorStoryMetadataTag,
  MonetizationPriceBand,
  AuthorStoryPublication,
  AuthorStoryUpdateInput,
} from '../domain/author-story-management.models';
import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';
import { AuthorChapterVersionHttpService } from './author-chapter-version-http.service';
import { AuthorChapterMonetizationHttpService } from './author-chapter-monetization-http.service';
import { AuthorMediaUploadService } from './author-media-upload.service';
import { type CreateRetryState, idempotencyHeaders, reuseCreateKey } from './idempotency-http.util';

@Injectable()
export class AuthorStoryManagementHttpRepository implements AuthorStoryManagementRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly mediaUpload = inject(AuthorMediaUploadService);
  private readonly chapterVersions = inject(AuthorChapterVersionHttpService);
  private readonly chapterMonetization = inject(AuthorChapterMonetizationHttpService);
  private readonly storiesUrl = `${this.config.apiBaseUrl}/author/stories`;
  private readonly metadataUrl = `${this.config.apiBaseUrl}/story-metadata`;
  private storyCreateRetry: CreateRetryState | null = null;
  private chapterCreateRetry: CreateRetryState | null = null;

  listStories(): Observable<readonly AuthorManagedStory[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly AuthorManagedStory[]>>(this.storiesUrl)
      .pipe(map((response: ApiSuccessEnvelope<readonly AuthorManagedStory[]>) => response.data));
  }

  getStory(storyId: string): Observable<AuthorManagedStory> {
    return this.http
      .get<ApiSuccessEnvelope<AuthorManagedStory>>(`${this.storiesUrl}/${storyId}`)
      .pipe(map((response: ApiSuccessEnvelope<AuthorManagedStory>) => response.data));
  }

  createStory(input: AuthorStoryDraftInput): Observable<AuthorManagedStory> {
    const retry = reuseCreateKey(this.storyCreateRetry, input);
    this.storyCreateRetry = retry;

    return this.http
      .post<ApiSuccessEnvelope<AuthorManagedStory>>(this.storiesUrl, input, {
        headers: idempotencyHeaders(retry.key),
      })
      .pipe(
        map((response: ApiSuccessEnvelope<AuthorManagedStory>) => response.data),
        tap(() => {
          if (this.storyCreateRetry?.key === retry.key) {
            this.storyCreateRetry = null;
          }
        }),
      );
  }

  updateStory(storyId: string, input: AuthorStoryUpdateInput): Observable<AuthorManagedStory> {
    return this.http
      .patch<ApiSuccessEnvelope<AuthorManagedStory>>(`${this.storiesUrl}/${storyId}`, input)
      .pipe(map((response: ApiSuccessEnvelope<AuthorManagedStory>) => response.data));
  }

  deleteStory(storyId: string): Observable<void> {
    return this.http.delete<void>(`${this.storiesUrl}/${storyId}`);
  }

  listCategories(): Observable<readonly AuthorStoryMetadataCategory[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly AuthorStoryMetadataCategory[]>>(
        `${this.metadataUrl}/categories`,
      )
      .pipe(
        map(
          (response: ApiSuccessEnvelope<readonly AuthorStoryMetadataCategory[]>) => response.data,
        ),
      );
  }

  listTags(): Observable<readonly AuthorStoryMetadataTag[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly AuthorStoryMetadataTag[]>>(`${this.metadataUrl}/tags`)
      .pipe(
        map((response: ApiSuccessEnvelope<readonly AuthorStoryMetadataTag[]>) => response.data),
      );
  }

  submitStory(storyId: string, authorNote: string): Observable<AuthorStoryPublication> {
    return this.http
      .post<ApiSuccessEnvelope<AuthorStoryPublication>>(
        `${this.storiesUrl}/${storyId}/submit`,
        authorNote.trim() ? { authorNote: authorNote.trim() } : {},
        { headers: idempotencyHeaders() },
      )
      .pipe(map((response: ApiSuccessEnvelope<AuthorStoryPublication>) => response.data));
  }

  cancelSubmission(storyId: string): Observable<AuthorStoryPublication> {
    return this.http
      .post<ApiSuccessEnvelope<AuthorStoryPublication>>(
        `${this.storiesUrl}/${storyId}/submission/cancel`,
        {},
        { headers: idempotencyHeaders() },
      )
      .pipe(map((response: ApiSuccessEnvelope<AuthorStoryPublication>) => response.data));
  }

  listChapters(storyId: string): Observable<readonly AuthorManagedChapterSummary[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly AuthorManagedChapterSummary[]>>(
        `${this.storiesUrl}/${storyId}/chapters`,
      )
      .pipe(
        map(
          (response: ApiSuccessEnvelope<readonly AuthorManagedChapterSummary[]>) => response.data,
        ),
      );
  }

  getChapter(storyId: string, chapterId: string): Observable<AuthorManagedChapter> {
    return this.http
      .get<ApiSuccessEnvelope<AuthorManagedChapter>>(
        `${this.storiesUrl}/${storyId}/chapters/${chapterId}`,
      )
      .pipe(map((response: ApiSuccessEnvelope<AuthorManagedChapter>) => response.data));
  }

  createChapter(storyId: string, input: AuthorChapterDraftInput): Observable<AuthorManagedChapter> {
    const retry = reuseCreateKey(this.chapterCreateRetry, { storyId, input });
    this.chapterCreateRetry = retry;

    return this.http
      .post<ApiSuccessEnvelope<AuthorManagedChapter>>(
        `${this.storiesUrl}/${storyId}/chapters`,
        input,
        { headers: idempotencyHeaders(retry.key) },
      )
      .pipe(
        map((response: ApiSuccessEnvelope<AuthorManagedChapter>) => response.data),
        tap(() => {
          if (this.chapterCreateRetry?.key === retry.key) {
            this.chapterCreateRetry = null;
          }
        }),
      );
  }

  updateChapter(
    storyId: string,
    chapterId: string,
    input: AuthorChapterDraftInput,
  ): Observable<AuthorManagedChapter> {
    return this.http
      .patch<ApiSuccessEnvelope<AuthorManagedChapter>>(
        `${this.storiesUrl}/${storyId}/chapters/${chapterId}`,
        input,
      )
      .pipe(map((response: ApiSuccessEnvelope<AuthorManagedChapter>) => response.data));
  }

  listMonetizationPriceBands(): Observable<readonly MonetizationPriceBand[]> {
    return this.chapterMonetization.listPriceBands();
  }

  getChapterMonetization(
    storyId: string,
    chapterId: string,
  ): Observable<AuthorChapterMonetization> {
    return this.chapterMonetization.get(storyId, chapterId);
  }

  updateChapterMonetization(
    storyId: string,
    chapterId: string,
    input: { readonly accessType: 'FREE' | 'PAID'; readonly priceBandId?: string },
  ): Observable<AuthorChapterMonetization> {
    return this.chapterMonetization.update(storyId, chapterId, input);
  }

  listChapterVersions(
    storyId: string,
    chapterId: string,
    page: number,
    pageSize: number,
  ): Observable<AuthorChapterVersionPage> {
    return this.chapterVersions.list(storyId, chapterId, page, pageSize);
  }

  getChapterVersion(
    storyId: string,
    chapterId: string,
    version: number,
  ): Observable<AuthorChapterVersion> {
    return this.chapterVersions.get(storyId, chapterId, version);
  }

  restoreChapterVersion(
    storyId: string,
    chapterId: string,
    version: number,
  ): Observable<AuthorManagedChapter> {
    return this.chapterVersions.restore(storyId, chapterId, version);
  }

  deleteChapter(storyId: string, chapterId: string): Observable<void> {
    return this.http.delete<void>(`${this.storiesUrl}/${storyId}/chapters/${chapterId}`);
  }

  publishChapter(storyId: string, chapterId: string): Observable<AuthorManagedChapter> {
    return this.http
      .post<ApiSuccessEnvelope<AuthorManagedChapter>>(
        `${this.storiesUrl}/${storyId}/chapters/${chapterId}/publish`,
        {},
        { headers: idempotencyHeaders() },
      )
      .pipe(map((response: ApiSuccessEnvelope<AuthorManagedChapter>) => response.data));
  }

  scheduleChapter(
    storyId: string,
    chapterId: string,
    scheduledAt: string,
  ): Observable<AuthorManagedChapter> {
    return this.http
      .put<ApiSuccessEnvelope<AuthorManagedChapter>>(
        `${this.storiesUrl}/${storyId}/chapters/${chapterId}/schedule`,
        { scheduledAt },
      )
      .pipe(map((response: ApiSuccessEnvelope<AuthorManagedChapter>) => response.data));
  }

  cancelChapterSchedule(storyId: string, chapterId: string): Observable<AuthorManagedChapter> {
    return this.http
      .delete<ApiSuccessEnvelope<AuthorManagedChapter>>(
        `${this.storiesUrl}/${storyId}/chapters/${chapterId}/schedule`,
      )
      .pipe(map((response: ApiSuccessEnvelope<AuthorManagedChapter>) => response.data));
  }

  uploadCover(storyId: string, file: File): Observable<AuthorStoryMedia> {
    return this.mediaUpload.uploadStoryCover(storyId, file);
  }

  uploadChapterImage(chapterId: string, file: File): Observable<AuthorStoryMedia> {
    return this.mediaUpload.uploadChapterImage(chapterId, file);
  }

  getMedia(mediaId: string): Observable<AuthorStoryMedia> {
    return this.mediaUpload.getMedia(mediaId);
  }

  listContributors(storyId: string): Observable<readonly AuthorStoryContributor[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly AuthorStoryContributor[]>>(
        `${this.storiesUrl}/${storyId}/contributors`,
      )
      .pipe(map((response) => response.data));
  }

  upsertContributor(
    storyId: string,
    input: AuthorStoryContributorInput,
  ): Observable<AuthorStoryContributor> {
    return this.http
      .put<ApiSuccessEnvelope<AuthorStoryContributor>>(
        `${this.storiesUrl}/${storyId}/contributors`,
        input,
      )
      .pipe(map((response) => response.data));
  }

  removeContributor(
    storyId: string,
    contributorUserId: string,
    role: AuthorStoryContributorRole,
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.storiesUrl}/${storyId}/contributors/${contributorUserId}/${role}`,
    );
  }
}

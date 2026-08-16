import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, tap } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import {
  AuthorChapterDraftInput,
  AuthorManagedChapter,
  AuthorManagedChapterSummary,
  AuthorManagedStory,
  AuthorStoryDraftInput,
  AuthorStoryMedia,
  AuthorStoryMetadataCategory,
  AuthorStoryMetadataTag,
  AuthorStoryPublication,
  AuthorStoryUpdateInput,
} from '../domain/author-story-management.models';
import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';
import { AuthorStoryCoverUploadService } from './author-story-cover-upload.service';

@Injectable()
export class AuthorStoryManagementHttpRepository implements AuthorStoryManagementRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly coverUpload = inject(AuthorStoryCoverUploadService);
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

  uploadCover(storyId: string, file: File): Observable<AuthorStoryMedia> {
    return this.coverUpload.upload(storyId, file);
  }

  getMedia(mediaId: string): Observable<AuthorStoryMedia> {
    return this.http
      .get<ApiSuccessEnvelope<AuthorStoryMedia>>(`${this.config.apiBaseUrl}/media/${mediaId}`)
      .pipe(map((response: ApiSuccessEnvelope<AuthorStoryMedia>) => response.data));
  }
}

interface CreateRetryState {
  readonly identity: string;
  readonly key: string;
}

function reuseCreateKey(current: CreateRetryState | null, payload: unknown): CreateRetryState {
  const identity = JSON.stringify(payload) ?? 'undefined';
  if (current?.identity === identity) return current;

  return { identity, key: crypto.randomUUID() };
}

function idempotencyHeaders(key: string = crypto.randomUUID()): HttpHeaders {
  return new HttpHeaders({ 'x-idempotency-key': key });
}

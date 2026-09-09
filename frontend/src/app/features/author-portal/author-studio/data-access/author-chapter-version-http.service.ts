import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import { ChapterVersionDiff } from '../domain/chapter-editing.models';
import {
  AuthorChapterVersion,
  AuthorChapterVersionPage,
  AuthorManagedChapter,
} from '../domain/author-story-management.models';

@Injectable()
export class AuthorChapterVersionHttpService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly storiesUrl = `${this.config.apiBaseUrl}/author/stories`;

  list(
    storyId: string,
    chapterId: string,
    page: number,
    pageSize: number,
    includeAutosaves = false,
  ): Observable<AuthorChapterVersionPage> {
    return this.http
      .get<ApiSuccessEnvelope<AuthorChapterVersionPage>>(`${this.versionUrl(storyId, chapterId)}`, {
        params: { page, pageSize, includeAutosaves },
      })
      .pipe(map((response) => response.data));
  }

  get(storyId: string, chapterId: string, version: number): Observable<AuthorChapterVersion> {
    return this.http
      .get<ApiSuccessEnvelope<AuthorChapterVersion>>(
        `${this.versionUrl(storyId, chapterId)}/${version}`,
      )
      .pipe(map((response) => response.data));
  }

  diff(
    storyId: string,
    chapterId: string,
    from: number,
    to: number,
  ): Observable<ChapterVersionDiff> {
    return this.http
      .get<ApiSuccessEnvelope<ChapterVersionDiff>>(`${this.versionUrl(storyId, chapterId)}/diff`, {
        params: { from, to },
      })
      .pipe(map((response) => response.data));
  }

  restore(
    storyId: string,
    chapterId: string,
    version: number,
    expectedVersion: number,
  ): Observable<AuthorManagedChapter> {
    return this.http
      .post<ApiSuccessEnvelope<AuthorManagedChapter>>(
        `${this.versionUrl(storyId, chapterId)}/${version}/restore`,
        { expectedVersion },
        { headers: new HttpHeaders({ 'x-idempotency-key': crypto.randomUUID() }) },
      )
      .pipe(map((response) => response.data));
  }

  private versionUrl(storyId: string, chapterId: string): string {
    return `${this.storiesUrl}/${storyId}/chapters/${chapterId}/versions`;
  }
}

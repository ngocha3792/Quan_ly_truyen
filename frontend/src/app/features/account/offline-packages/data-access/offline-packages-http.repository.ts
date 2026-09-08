import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import { PublicStoriesApiClient } from '../../../../core/http/public-stories-api.client';
import { ReaderEngagementApiClient } from '../../../../core/http/reader-engagement-api.client';
import {
  CreateOfflinePackageInput,
  OfflinePackageSummary,
  OfflineQuota,
  OfflineSourceChapterPage,
  OfflineSourceStory,
} from '../domain/offline-package.models';
import { OfflinePackagesRepository } from '../domain/offline-packages.repository';

@Injectable()
export class OfflinePackagesHttpRepository implements OfflinePackagesRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly stories = inject(PublicStoriesApiClient);
  private readonly engagement = inject(ReaderEngagementApiClient);
  private readonly baseUrl = `${this.config.apiBaseUrl}/offline-packages`;

  listPackages(): Observable<readonly OfflinePackageSummary[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly OfflinePackageSummary[]>>(this.baseUrl)
      .pipe(map((response) => response.data));
  }

  getQuota(): Observable<OfflineQuota> {
    return this.http
      .get<ApiSuccessEnvelope<OfflineQuota>>(`${this.baseUrl}/quota`)
      .pipe(map((response) => response.data));
  }

  createPackage(input: CreateOfflinePackageInput): Observable<OfflinePackageSummary> {
    const body = {
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      chapterIds: input.chapterIds,
    };
    const headers = new HttpHeaders({ 'x-idempotency-key': input.idempotencyKey });

    return this.http
      .post<ApiSuccessEnvelope<OfflinePackageSummary>>(this.baseUrl, body, { headers })
      .pipe(map((response) => response.data));
  }

  deletePackage(packageId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(packageId)}`);
  }

  touchPackage(packageId: string): Observable<void> {
    return this.http
      .patch<
        ApiSuccessEnvelope<{ readonly lastAccessedAt: string; readonly autoDeleteAt: string }>
      >(`${this.baseUrl}/${encodeURIComponent(packageId)}/touch`, {})
      .pipe(map(() => undefined));
  }

  listSourceStories(): Observable<readonly OfflineSourceStory[]> {
    return forkJoin({
      library: this.engagement.listLibrary(),
      catalog: this.stories.list({ sort: 'popular', pageSize: 30 }),
    }).pipe(
      map(({ library, catalog }) => {
        const libraryIds = new Set(library.map((entry) => entry.story.id));
        const byId = new Map<string, OfflineSourceStory>();

        for (const entry of library) {
          byId.set(entry.story.id, {
            id: entry.story.id,
            slug: entry.story.slug,
            title: entry.story.title,
            author: entry.story.author,
            coverUrl: entry.story.coverUrl,
            chapterCount: entry.story.chapterCount,
            inLibrary: true,
          });
        }

        for (const story of catalog.items) {
          if (byId.has(story.id)) continue;
          byId.set(story.id, {
            id: story.id,
            slug: story.slug,
            title: story.title,
            author: story.author.penName,
            coverUrl: story.coverUrl,
            chapterCount: story.stats.chapters,
            inLibrary: libraryIds.has(story.id),
          });
        }

        return [...byId.values()];
      }),
    );
  }

  listStoryChapters(
    storySlug: string,
    page: number,
    pageSize: number,
  ): Observable<OfflineSourceChapterPage> {
    return this.stories.chapters(storySlug, page, pageSize).pipe(
      map((result) => ({
        items: result.items.map((chapter) => ({
          id: chapter.id,
          number: chapter.number,
          title: chapter.title,
          publishedAt: chapter.publishedAt,
        })),
        page: result.pagination.page,
        totalPages: result.pagination.totalPages,
      })),
    );
  }
}

import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { PublicStoriesApiClient } from '../../../../core/http/public-stories-api.client';
import { PublicStoryApiItem } from '../../../../core/http/public-stories-api.model';
import { STORY_COVER_PLACEHOLDER } from '../../../../shared/models/story.model';
import {
  StoryCatalogItem,
  StoryCatalogPage,
  StoryCatalogQuery,
  StoryGenre,
  StoryRankingItem,
} from '../domain/story-catalog.models';
import { StoryCatalogRepository } from './story-catalog.repository';

@Injectable()
export class StoryCatalogHttpRepository implements StoryCatalogRepository {
  private readonly api = inject(PublicStoriesApiClient);

  search(query: StoryCatalogQuery): Observable<StoryCatalogPage> {
    return this.api
      .list({
        q: query.query.trim() || undefined,
        genre: query.genre ?? undefined,
        status: query.status === 'all' ? undefined : query.status,
        sort: query.sort,
        yearFrom: query.yearFrom ?? undefined,
        yearTo: query.yearTo ?? undefined,
        page: query.page,
        pageSize: query.pageSize,
      })
      .pipe(
        map((page) => ({
          items: page.items.map(toCatalogItem),
          pagination: page.pagination,
        })),
      );
  }

  getGenres(): Observable<readonly StoryGenre[]> {
    return this.api.list({ sort: 'popular', pageSize: 100 }).pipe(
      map((page) => {
        const genres = new Map<string, StoryGenre>();
        for (const story of page.items) {
          for (const category of story.categories) {
            genres.set(category.id, {
              id: category.id,
              slug: category.slug,
              name: category.name,
            });
          }
        }
        return [...genres.values()].sort((left, right) =>
          left.name.localeCompare(right.name, 'vi'),
        );
      }),
    );
  }

  getRanking(limit: number): Observable<readonly StoryRankingItem[]> {
    return this.api.list({ sort: 'popular', pageSize: Math.min(Math.max(limit, 1), 100) }).pipe(
      map((page) =>
        page.items.map((story) => ({
          id: story.id,
          slug: story.slug,
          title: story.title,
          coverUrl: story.coverUrl ?? STORY_COVER_PLACEHOLDER,
          genres: story.categories.map(({ slug, name }) => ({ slug, name })),
          views: story.stats.views,
          rating: story.stats.ratingAverage,
        })),
      ),
    );
  }
}

function toCatalogItem(story: PublicStoryApiItem): StoryCatalogItem {
  return {
    id: story.id,
    slug: story.slug,
    title: story.title,
    authorName: story.author.penName,
    description: story.synopsis,
    coverUrl: story.coverUrl ?? STORY_COVER_PLACEHOLDER,
    genres: story.categories.map(({ slug, name }) => ({ slug, name })),
    status: story.status.toLowerCase() as StoryCatalogItem['status'],
    badge: story.status === 'COMPLETED' ? 'FULL' : null,
    latestChapter: story.latestChapter?.number ?? null,
    chapterCount: story.stats.chapters,
    views: story.stats.views,
    rating: story.stats.ratingAverage,
    releaseYear: story.releaseYear,
    updatedAt: story.updatedAt,
  };
}

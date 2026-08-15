import { inject, Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';

import { PublicStoriesApiClient } from '../../../../core/http/public-stories-api.client';
import { PublicStoryApiItem } from '../../../../core/http/public-stories-api.model';
import { STORY_COVER_PLACEHOLDER } from '../../../../shared/models/story.model';
import { RelatedStoryItem, Story, StoryComment } from '../domain/story.models';
import { StoryDetailRepository } from './story.repository';

@Injectable()
export class StoryDetailHttpRepository implements StoryDetailRepository {
  private readonly api = inject(PublicStoriesApiClient);
  private categorySlugs: readonly string[] = [];
  private currentSlug = '';

  getStoryBySlug(slug: string): Observable<Story | null> {
    this.currentSlug = slug;
    return this.api.detail(slug).pipe(
      map((story) => {
        this.categorySlugs = story.categories.map((category) => category.slug);
        return toStory(story);
      }),
    );
  }

  getComments(_storyId: string): Observable<readonly StoryComment[]> {
    return of([]);
  }

  getRelatedStories(_categories: readonly string[]): Observable<readonly RelatedStoryItem[]> {
    const genre = this.categorySlugs[0];
    if (!genre) {
      return of([]);
    }

    return this.api.list({ genre, sort: 'popular', pageSize: 6 }).pipe(
      map((page) =>
        page.items
          .filter((story) => story.slug !== this.currentSlug)
          .slice(0, 5)
          .map((story) => ({
            title: story.title,
            slug: story.slug,
            coverUrl: story.coverUrl ?? STORY_COVER_PLACEHOLDER,
            latestChapter: story.latestChapter?.number ?? null,
          })),
      ),
    );
  }
}

function toStory(story: PublicStoryApiItem): Story {
  return {
    id: story.id,
    slug: story.slug,
    title: story.title,
    author: story.author.penName,
    description: story.synopsis,
    coverUrl: story.coverUrl ?? STORY_COVER_PLACEHOLDER,
    categories: story.categories.map((category) => category.name),
    latestChapter: story.latestChapter
      ? {
          number: story.latestChapter.number,
          title: story.latestChapter.title,
          slug: story.latestChapter.slug,
          updatedAt: story.latestChapter.publishedAt,
        }
      : null,
    views: story.stats.views,
    rating: story.stats.ratingAverage,
    chapterCount: story.stats.chapters,
    status: story.status,
    badge: story.status === 'COMPLETED' ? 'FULL' : undefined,
  };
}

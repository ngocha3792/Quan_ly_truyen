import { Injectable } from '@angular/core';

import { delay, Observable, of } from 'rxjs';

import {
  StoryUpdateItem,
  StoryUpdatesOverview,
  StoryUpdatesQuery,
} from '../domain/story-updates.models';

import {
  STORY_UPDATE_GENRES_MOCK,
  STORY_UPDATE_ITEMS_MOCK,
  STORY_UPDATE_SCHEDULE_MOCK,
  STORY_UPDATE_STATS_MOCK,
} from '../mock/story-updates.mock';

import { StoryUpdatesRepository } from './story-updates.repository';

@Injectable()
export class StoryUpdatesMockRepository implements StoryUpdatesRepository {
  getOverview(query: StoryUpdatesQuery): Observable<StoryUpdatesOverview> {
    const featured = STORY_UPDATE_ITEMS_MOCK[0] ?? null;

    let items = STORY_UPDATE_ITEMS_MOCK.filter((story) => story.id !== featured?.id);

    items = filterStories(items, query.tab);

    items = sortStories(items, query.sort);

    const totalItems = items.length;

    const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));

    const safePage = Math.min(Math.max(query.page, 1), totalPages);

    const start = (safePage - 1) * query.pageSize;

    const paginatedItems = items.slice(start, start + query.pageSize);

    const topUpdates = [...STORY_UPDATE_ITEMS_MOCK]
      .sort((left, right) => right.viewCount - left.viewCount)
      .slice(0, 5);

    return of({
      featured,
      items: paginatedItems,

      topUpdates,

      stats: STORY_UPDATE_STATS_MOCK,

      schedule: STORY_UPDATE_SCHEDULE_MOCK,

      popularGenres: STORY_UPDATE_GENRES_MOCK,

      pagination: {
        page: safePage,
        pageSize: query.pageSize,
        totalItems,
        totalPages,
      },

      generatedAt: new Date().toISOString(),
    }).pipe(delay(320));
  }
}

function filterStories(
  stories: readonly StoryUpdateItem[],

  tab: StoryUpdatesQuery['tab'],
): StoryUpdateItem[] {
  switch (tab) {
    case 'latest':
      return stories.filter(
        (story) => Date.now() - new Date(story.updatedAt).getTime() <= 60 * 60 * 1000,
      );

    case 'following':
      return stories.filter((story) => story.followed);

    case 'hot':
      return stories.filter((story) => story.hot);

    case 'completed':
      return stories.filter((story) => story.status === 'completed');

    case 'all':
    default:
      return [...stories];
  }
}

function sortStories(
  stories: readonly StoryUpdateItem[],

  sort: StoryUpdatesQuery['sort'],
): StoryUpdateItem[] {
  const result = [...stories];

  switch (sort) {
    case 'views':
      return result.sort((left, right) => right.viewCount - left.viewCount);

    case 'title':
      return result.sort((left, right) => left.title.localeCompare(right.title, 'vi'));

    case 'latest':
    default:
      return result.sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      );
  }
}

import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, switchMap } from 'rxjs';

import { AuthStore } from '../../../../core/auth/auth.store';
import { AuthorFollowApiService } from '../../../../core/author-follow';
import { PublicStoriesApiClient } from '../../../../core/http/public-stories-api.client';
import { PublicStoryApiItem } from '../../../../core/http/public-stories-api.model';
import { STORY_COVER_PLACEHOLDER } from '../../../../shared/models/story.model';
import {
  StoryUpdateItem,
  StoryUpdateStat,
  StoryUpdatesOverview,
  StoryUpdatesQuery,
} from '../domain/story-updates.models';
import { StoryUpdatesRepository } from './story-updates.repository';

@Injectable()
export class StoryUpdatesHttpRepository implements StoryUpdatesRepository {
  private readonly api = inject(PublicStoriesApiClient);
  private readonly followApi = inject(AuthorFollowApiService);
  private readonly auth = inject(AuthStore);

  getOverview(query: StoryUpdatesQuery): Observable<StoryUpdatesOverview> {
    return this.api
      .list({ sort: 'latest', pageSize: 100 })
      .pipe(
        switchMap((page) =>
          this.followedStoryIds(page.items).pipe(
            map((followedIds) => buildOverview(page.items, query, followedIds)),
          ),
        ),
      );
  }

  private followedStoryIds(
    stories: readonly PublicStoryApiItem[],
  ): Observable<ReadonlySet<string>> {
    return this.auth.ensureInitialized().pipe(
      switchMap((authState) =>
        authState === 'authenticated'
          ? this.followApi.getStoryFollows(stories.map((story) => story.id)).pipe(
              map((ids) => new Set(ids)),
              catchError(() => of(new Set<string>())),
            )
          : of(new Set<string>()),
      ),
    );
  }
}

function buildOverview(
  stories: readonly PublicStoryApiItem[],
  query: StoryUpdatesQuery,
  followedIds: ReadonlySet<string>,
): StoryUpdatesOverview {
  const allItems = stories.map((story) => toUpdateItem(story, followedIds));
  const featured = allItems[0] ?? null;
  let items = featured ? allItems.filter((story) => story.id !== featured.id) : allItems;

  items = filterStories(items, query.tab);
  items = sortStories(items, query.sort);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
  const page = Math.min(Math.max(query.page, 1), totalPages);
  const start = (page - 1) * query.pageSize;
  const topUpdates = [...allItems]
    .sort((left, right) => right.viewCount - left.viewCount)
    .slice(0, 5);

  return {
    featured,
    items: items.slice(start, start + query.pageSize),
    topUpdates,
    stats: buildStats(stories, allItems),
    schedule: [],
    popularGenres: buildPopularGenres(stories),
    pagination: {
      page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
    generatedAt: new Date().toISOString(),
  };
}

function toUpdateItem(
  story: PublicStoryApiItem,
  followedIds: ReadonlySet<string>,
): StoryUpdateItem {
  const recentlyUpdated = Date.now() - new Date(story.updatedAt).getTime() <= 24 * 60 * 60 * 1000;
  const hot = story.stats.views >= 1000 || story.stats.followers >= 100;

  return {
    id: story.id,
    slug: story.slug,
    title: story.title,
    description: story.synopsis,
    coverUrl: story.coverUrl ?? STORY_COVER_PLACEHOLDER,
    bannerUrl: story.coverUrl,
    genres: story.categories.map(({ slug, name }) => ({ slug, name })),
    latestChapter: story.latestChapter?.number ?? null,
    previousChapter: null,
    updatedAt: story.updatedAt,
    viewCount: story.stats.views,
    commentCount: story.stats.comments,
    status: story.status === 'COMPLETED' ? 'completed' : 'ongoing',
    badge: recentlyUpdated ? 'new' : hot ? 'hot' : null,
    followed: followedIds.has(story.id),
    hot,
  };
}

function filterStories(
  stories: readonly StoryUpdateItem[],
  tab: StoryUpdatesQuery['tab'],
): StoryUpdateItem[] {
  switch (tab) {
    case 'latest':
      return stories.filter(
        (story) => Date.now() - new Date(story.updatedAt).getTime() <= 24 * 60 * 60 * 1000,
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

function buildStats(
  stories: readonly PublicStoryApiItem[],
  items: readonly StoryUpdateItem[],
): readonly StoryUpdateStat[] {
  const today = new Date().toDateString();
  const chaptersToday = stories.filter(
    (story) => story.lastChapterAt && new Date(story.lastChapterAt).toDateString() === today,
  ).length;
  const followingCount = items.filter((story) => story.followed).length;

  return [
    {
      id: 'updated-stories',
      label: 'Truyện đang hiển thị',
      value: stories.length,
      valueSuffix: null,
      comparisonText: 'Dữ liệu công khai hiện tại',
      tone: 'purple',
    },
    {
      id: 'chapters-today',
      label: 'Có chương mới hôm nay',
      value: chaptersToday,
      valueSuffix: null,
      comparisonText: 'Dựa trên thời điểm chương mới nhất',
      tone: 'blue',
    },
    {
      id: 'following',
      label: 'Đang theo dõi',
      value: followingCount,
      valueSuffix: null,
      comparisonText: 'Trong số truyện đang hiển thị',
      tone: 'pink',
    },
    {
      id: 'average-speed',
      label: 'Tốc độ cập nhật',
      value: 0,
      valueSuffix: null,
      comparisonText: 'Chưa có dữ liệu lịch sử để tính',
      tone: 'orange',
    },
  ];
}

function buildPopularGenres(stories: readonly PublicStoryApiItem[]) {
  const counts = new Map<string, { slug: string; name: string; count: number }>();
  for (const story of stories) {
    for (const category of story.categories) {
      const current = counts.get(category.slug);
      counts.set(category.slug, {
        slug: category.slug,
        name: category.name,
        count: (current?.count ?? 0) + 1,
      });
    }
  }

  return [...counts.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 8)
    .map(({ slug, name }) => ({ slug, name }));
}

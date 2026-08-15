import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { PublicStoriesApiClient } from '../../../../core/http/public-stories-api.client';
import { PublicStoryApiItem } from '../../../../core/http/public-stories-api.model';
import { STORY_COVER_PLACEHOLDER } from '../../../../shared/models/story.model';
import {
  GenreRankingDistribution,
  RankingTone,
  StoryRankingItem,
  StoryRankingOverview,
  StoryRankingQuery,
} from '../domain/story-ranking.models';
import { StoryRankingRepository } from './story-ranking.repository';

const TONES: readonly RankingTone[] = ['purple', 'blue', 'pink', 'orange', 'green'];

@Injectable()
export class StoryRankingHttpRepository implements StoryRankingRepository {
  private readonly api = inject(PublicStoriesApiClient);

  getOverview(query: StoryRankingQuery): Observable<StoryRankingOverview> {
    return this.api.list({ sort: 'popular', pageSize: 100 }).pipe(
      map((page) => buildOverview(page.items, query)),
    );
  }
}

function buildOverview(
  stories: readonly PublicStoryApiItem[],
  query: StoryRankingQuery,
): StoryRankingOverview {
  const mapped = stories.map(toRankingItem);
  const ranked = sortStories(mapped, query.metric)
    .slice(0, query.limit)
    .map((story, index) => ({ ...story, rank: index + 1 }));

  const totalReads = ranked.reduce((sum, story) => sum + story.viewCount, 0);
  const followerCount = ranked.reduce((sum, story) => sum + story.followerCount, 0);
  const maximumValue = Math.max(...ranked.map((story) => story.viewCount), 1);

  return {
    items: ranked,
    summary: {
      totalReads,
      totalReadsChangePercent: 0,
      hotStoryCount: ranked.filter((story) => story.popularityScore >= 70).length,
      hotStoryChange: 0,
      followerCount,
      followerChangePercent: 0,
    },
    genres: buildGenreDistribution(stories),
    trends: [...ranked]
      .sort((left, right) => right.trendingScore - left.trendingScore)
      .slice(0, 5)
      .map((story) => ({
        id: story.id,
        slug: story.slug,
        title: story.title,
        coverUrl: story.coverUrl,
        value: story.viewCount,
        maximumValue,
      })),
    generatedAt: new Date().toISOString(),
  };
}

function toRankingItem(story: PublicStoryApiItem): StoryRankingItem {
  const popularityScore = normalizedScore(story.stats.views, story.stats.followers);
  const trendingScore = normalizedScore(
    story.stats.views + story.stats.comments * 20,
    story.stats.followers,
  );

  return {
    id: story.id,
    slug: story.slug,
    rank: 0,
    rankChange: 0,
    title: story.title,
    authorName: story.author.penName,
    coverUrl: story.coverUrl ?? STORY_COVER_PLACEHOLDER,
    genres: story.categories.map(({ slug, name }) => ({ slug, name })),
    latestChapter: story.latestChapter?.number ?? null,
    viewCount: story.stats.views,
    rating: story.stats.ratingAverage,
    ratingCount: story.stats.ratingCount,
    followerCount: story.stats.followers,
    popularityScore,
    trendingScore,
  };
}

function sortStories(
  stories: readonly StoryRankingItem[],
  metric: StoryRankingQuery['metric'],
): StoryRankingItem[] {
  const result = [...stories];
  switch (metric) {
    case 'rating':
      return result.sort(
        (left, right) => right.rating - left.rating || right.ratingCount - left.ratingCount,
      );
    case 'followers':
      return result.sort((left, right) => right.followerCount - left.followerCount);
    case 'trending':
      return result.sort((left, right) => right.trendingScore - left.trendingScore);
    case 'popular':
    default:
      return result.sort((left, right) => right.viewCount - left.viewCount);
  }
}

function buildGenreDistribution(
  stories: readonly PublicStoryApiItem[],
): readonly GenreRankingDistribution[] {
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

  const total = Math.max([...counts.values()].reduce((sum, item) => sum + item.count, 0), 1);
  return [...counts.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 5)
    .map((item, index) => ({
      slug: item.slug,
      name: item.name,
      percentage: Math.round((item.count / total) * 100),
      tone: TONES[index % TONES.length] ?? 'blue',
    }));
}

function normalizedScore(primary: number, secondary: number): number {
  const weighted = Math.log10(Math.max(primary, 1)) * 18 + Math.log10(Math.max(secondary, 1)) * 10;
  return Math.min(100, Math.max(0, Math.round(weighted)));
}

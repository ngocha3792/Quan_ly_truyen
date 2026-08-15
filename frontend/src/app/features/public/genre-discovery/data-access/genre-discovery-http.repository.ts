import { inject, Injectable } from '@angular/core';
import { map, Observable, shareReplay } from 'rxjs';

import { PublicStoriesApiClient } from '../../../../core/http/public-stories-api.client';
import { PublicStoryApiItem } from '../../../../core/http/public-stories-api.model';
import {
  GenreDiscoveryQuery,
  GenreRankingItem,
  GenreSummary,
  GenreTone,
  GenreTrendingItem,
  GenreVisual,
} from '../domain/genre-discovery.models';
import { GenreDiscoveryRepository } from './genre-discovery.repository';

interface GenreAggregate {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly storyCount: number;
  readonly reads: number;
  readonly coverUrl: string | null;
}

const TONES: readonly GenreTone[] = [
  'red',
  'violet',
  'pink',
  'yellow',
  'purple',
  'orange',
  'gray',
  'blue',
  'cyan',
  'indigo',
];
const VISUALS: readonly GenreVisual[] = [
  'action',
  'fantasy',
  'romance',
  'comedy',
  'manhwa',
  'manhua',
  'horror',
  'drama',
  'adventure',
  'school-life',
  'sci-fi',
  'isekai',
];

@Injectable()
export class GenreDiscoveryHttpRepository implements GenreDiscoveryRepository {
  private readonly api = inject(PublicStoriesApiClient);

  private readonly aggregates$ = this.api.list({ sort: 'popular', pageSize: 100 }).pipe(
    map((page) => aggregateGenres(page.items)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  getGenres(): Observable<readonly GenreSummary[]> {
    return this.aggregates$.pipe(map((genres) => genres.map(toSummary)));
  }

  getFeaturedGenres(limit: number): Observable<readonly GenreSummary[]> {
    return this.aggregates$.pipe(
      map((genres) => genres.slice(0, Math.max(0, limit)).map(toSummary)),
    );
  }

  getRanking(limit: number): Observable<readonly GenreRankingItem[]> {
    return this.aggregates$.pipe(
      map((genres) =>
        genres.slice(0, Math.max(0, limit)).map((genre, index) => ({
          id: genre.id,
          slug: genre.slug,
          name: genre.name,
          storyCount: genre.storyCount,
          rank: index + 1,
          tone: toneFor(genre.slug),
        })),
      ),
    );
  }

  getTrending(
    query: Pick<GenreDiscoveryQuery, 'trendingLimit' | 'trendingPeriod'>,
  ): Observable<readonly GenreTrendingItem[]> {
    return this.aggregates$.pipe(
      map((genres) => {
        const maximumReads = Math.max(...genres.map((genre) => genre.reads), 1);
        return [...genres]
          .sort((left, right) => right.reads - left.reads)
          .slice(0, Math.max(0, query.trendingLimit))
          .map((genre) => ({
            id: genre.id,
            slug: genre.slug,
            name: genre.name,
            coverUrl: genre.coverUrl,
            percent: Math.round((genre.reads / maximumReads) * 100),
            readingCount: genre.reads,
            tone: toneFor(genre.slug),
          }));
      }),
    );
  }
}

function aggregateGenres(stories: readonly PublicStoryApiItem[]): GenreAggregate[] {
  const aggregates = new Map<string, GenreAggregate>();

  for (const story of stories) {
    for (const category of story.categories) {
      const current = aggregates.get(category.id);
      aggregates.set(category.id, {
        id: category.id,
        slug: category.slug,
        name: category.name,
        storyCount: (current?.storyCount ?? 0) + 1,
        reads: (current?.reads ?? 0) + story.stats.views,
        coverUrl: current?.coverUrl ?? story.coverUrl,
      });
    }
  }

  return [...aggregates.values()].sort(
    (left, right) => right.storyCount - left.storyCount || left.name.localeCompare(right.name, 'vi'),
  );
}

function toSummary(genre: GenreAggregate): GenreSummary {
  return {
    id: genre.id,
    slug: genre.slug,
    name: genre.name,
    description: `${genre.storyCount} truyện đang phát hành`,
    visual: visualFor(genre.slug),
    tone: toneFor(genre.slug),
    storyCount: genre.storyCount,
    coverUrl: genre.coverUrl,
  };
}

function toneFor(slug: string): GenreTone {
  return TONES[hash(slug) % TONES.length] ?? 'blue';
}

function visualFor(slug: string): GenreVisual {
  return VISUALS[hash(slug) % VISUALS.length] ?? 'fantasy';
}

function hash(value: string): number {
  return [...value].reduce((result, char) => (result * 31 + char.charCodeAt(0)) >>> 0, 0);
}

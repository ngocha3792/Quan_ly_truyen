import { InjectionToken } from '@angular/core';

import { Observable } from 'rxjs';

import {
  GenreDiscoveryQuery,
  GenreRankingItem,
  GenreSummary,
  GenreTrendingItem,
} from '../domain/genre-discovery.models';

export interface GenreDiscoveryEndpoints {
  readonly genres: string;
  readonly featured: string;
  readonly ranking: string;
  readonly trending: string;
}

export const GENRE_DISCOVERY_ENDPOINTS = new InjectionToken<GenreDiscoveryEndpoints>(
  'GENRE_DISCOVERY_ENDPOINTS',
);

export abstract class GenreDiscoveryRepository {
  abstract getGenres(): Observable<readonly GenreSummary[]>;

  abstract getFeaturedGenres(limit: number): Observable<readonly GenreSummary[]>;

  abstract getRanking(limit: number): Observable<readonly GenreRankingItem[]>;

  abstract getTrending(
    query: Pick<GenreDiscoveryQuery, 'trendingLimit' | 'trendingPeriod'>,
  ): Observable<readonly GenreTrendingItem[]>;
}

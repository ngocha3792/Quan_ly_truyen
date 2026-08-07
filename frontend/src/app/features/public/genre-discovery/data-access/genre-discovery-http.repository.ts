import { HttpClient, HttpParams } from '@angular/common/http';

import { inject, Injectable } from '@angular/core';

import { map, Observable } from 'rxjs';

import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';

import {
  GenreDiscoveryQuery,
  GenreRankingItem,
  GenreSummary,
  GenreTrendingItem,
} from '../domain/genre-discovery.models';

import { GENRE_DISCOVERY_ENDPOINTS, GenreDiscoveryRepository } from './genre-discovery.repository';

@Injectable()
export class GenreDiscoveryHttpRepository implements GenreDiscoveryRepository {
  private readonly http = inject(HttpClient);

  private readonly endpoints = inject(GENRE_DISCOVERY_ENDPOINTS);

  getGenres(): Observable<readonly GenreSummary[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly GenreSummary[]>>(this.endpoints.genres)
      .pipe(map((response) => response.data));
  }

  getFeaturedGenres(limit: number): Observable<readonly GenreSummary[]> {
    const params = new HttpParams().set('limit', String(limit));

    return this.http
      .get<ApiSuccessEnvelope<readonly GenreSummary[]>>(this.endpoints.featured, { params })
      .pipe(map((response) => response.data));
  }

  getRanking(limit: number): Observable<readonly GenreRankingItem[]> {
    const params = new HttpParams().set('limit', String(limit));

    return this.http
      .get<ApiSuccessEnvelope<readonly GenreRankingItem[]>>(this.endpoints.ranking, { params })
      .pipe(map((response) => response.data));
  }

  getTrending(
    query: Pick<GenreDiscoveryQuery, 'trendingLimit' | 'trendingPeriod'>,
  ): Observable<readonly GenreTrendingItem[]> {
    const params = new HttpParams()
      .set('limit', String(query.trendingLimit))
      .set('period', query.trendingPeriod);

    return this.http
      .get<ApiSuccessEnvelope<readonly GenreTrendingItem[]>>(this.endpoints.trending, { params })
      .pipe(map((response) => response.data));
  }
}

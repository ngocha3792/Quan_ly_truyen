import { InjectionToken } from '@angular/core';

import { Observable } from 'rxjs';

import {
  StoryCatalogPage,
  StoryCatalogQuery,
  StoryGenre,
  StoryRankingItem,
} from '../domain/story-catalog.models';

export interface StoryCatalogEndpoints {
  readonly catalog: string;
  readonly genres: string;
  readonly ranking: string;
}

export const STORY_CATALOG_ENDPOINTS = new InjectionToken<StoryCatalogEndpoints>(
  'STORY_CATALOG_ENDPOINTS',
);

export abstract class StoryCatalogRepository {
  abstract search(query: StoryCatalogQuery): Observable<StoryCatalogPage>;

  abstract getGenres(): Observable<readonly StoryGenre[]>;

  abstract getRanking(limit: number): Observable<readonly StoryRankingItem[]>;
}

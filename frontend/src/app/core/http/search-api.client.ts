import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import type { ApiSuccessEnvelope } from './api-envelope.model';

export interface SearchHit {
  readonly id: string;
  readonly kind: 'story' | 'chapter';
  readonly title: string;
  readonly slug: string;
  readonly snippet: string;
  readonly authorName: string;
  readonly categories: readonly string[];
  readonly tags: readonly string[];
  readonly storyId: string;
  readonly storyTitle: string;
  readonly storySlug: string;
  readonly number: number | null;
  readonly accessState: 'FREE' | 'ENTITLED' | 'LOCKED';
}
export interface SearchPage {
  readonly hits: readonly SearchHit[];
  readonly totalHits: number;
  readonly totalPages: number;
  readonly page: number;
  readonly pageSize: number;
  readonly query: string;
  readonly engine: 'postgres' | 'meilisearch';
  readonly processingTimeMs: number;
}
export interface SearchFilters {
  readonly categories: readonly { name: string; slug: string }[];
  readonly tags: readonly { name: string; slug: string }[];
}
@Injectable({ providedIn: 'root' })
export class SearchApiClient {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  search(values: Readonly<Record<string, string | number | boolean | undefined>>) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return this.http
      .get<ApiSuccessEnvelope<SearchPage>>(`${this.config.apiBaseUrl}/search`, { params })
      .pipe(map((response) => response.data));
  }
  filters() {
    return this.http
      .get<ApiSuccessEnvelope<SearchFilters>>(`${this.config.apiBaseUrl}/search/filters`)
      .pipe(map((response) => response.data));
  }
}

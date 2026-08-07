import { HttpClient, HttpParams } from '@angular/common/http';

import { inject, Injectable } from '@angular/core';

import { map, Observable } from 'rxjs';

import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';

import { StoryUpdatesOverview, StoryUpdatesQuery } from '../domain/story-updates.models';

import { STORY_UPDATES_ENDPOINTS, StoryUpdatesRepository } from './story-updates.repository';

@Injectable()
export class StoryUpdatesHttpRepository implements StoryUpdatesRepository {
  private readonly http = inject(HttpClient);

  private readonly endpoints = inject(STORY_UPDATES_ENDPOINTS);

  getOverview(query: StoryUpdatesQuery): Observable<StoryUpdatesOverview> {
    const params = new HttpParams()
      .set('tab', query.tab)
      .set('sort', query.sort)
      .set('page', String(query.page))
      .set('pageSize', String(query.pageSize));

    return this.http
      .get<ApiSuccessEnvelope<StoryUpdatesOverview>>(this.endpoints.overview, { params })
      .pipe(map((response) => response.data));
  }
}

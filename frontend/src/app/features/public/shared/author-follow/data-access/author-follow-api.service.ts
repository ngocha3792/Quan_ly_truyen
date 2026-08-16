import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../../core/http/api-envelope.model';
import {
  AuthorFollowMutation,
  FollowingAuthorsPage,
} from '../domain/author-follow.models';

@Injectable({ providedIn: 'root' })
export class AuthorFollowApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);

  follow(authorId: string): Observable<AuthorFollowMutation> {
    return this.http
      .post<ApiSuccessEnvelope<AuthorFollowMutation>>(
        `${this.config.apiBaseUrl}/authors/${encodeURIComponent(authorId)}/follow`,
        {},
      )
      .pipe(map((response) => response.data));
  }

  unfollow(authorId: string): Observable<AuthorFollowMutation> {
    return this.http
      .delete<ApiSuccessEnvelope<AuthorFollowMutation>>(
        `${this.config.apiBaseUrl}/authors/${encodeURIComponent(authorId)}/follow`,
      )
      .pipe(map((response) => response.data));
  }

  getFollowing(
    authorIds?: readonly string[],
    page = 1,
    pageSize = authorIds?.length ? 50 : 20,
  ): Observable<FollowingAuthorsPage> {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (authorIds?.length) params['authorIds'] = authorIds.slice(0, 50).join(',');
    return this.http
      .get<ApiSuccessEnvelope<FollowingAuthorsPage>>(`${this.config.apiBaseUrl}/me/following`, {
        params,
      })
      .pipe(map((response) => response.data));
  }
}

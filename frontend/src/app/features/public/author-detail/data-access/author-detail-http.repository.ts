import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import { AuthorDetailView } from '../domain/author-detail.models';
import { AuthorDetailRepository } from '../domain/author-detail.repository';

@Injectable()
export class AuthorDetailHttpRepository implements AuthorDetailRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);

  getBySlug(slug: string): Observable<AuthorDetailView> {
    return this.http
      .get<ApiSuccessEnvelope<AuthorDetailView>>(
        `${this.config.apiBaseUrl}/authors/${encodeURIComponent(slug)}`,
      )
      .pipe(map((response) => response.data));
  }
}

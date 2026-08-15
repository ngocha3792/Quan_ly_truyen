import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import { AuthorStudioDashboard } from '../domain/author-studio.models';
import { AuthorStudioRepository } from '../domain/author-studio.repository';

@Injectable()
export class AuthorStudioHttpRepository implements AuthorStudioRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);

  getDashboard(): Observable<AuthorStudioDashboard> {
    return this.http
      .get<ApiSuccessEnvelope<AuthorStudioDashboard>>(
        `${this.config.apiBaseUrl}/author/dashboard`,
      )
      .pipe(map((response) => response.data));
  }
}

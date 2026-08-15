import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import { AuthorDirectoryView } from '../domain/author-directory.models';
import { AuthorDirectoryRepository } from '../domain/author-directory.repository';

@Injectable()
export class AuthorDirectoryHttpRepository implements AuthorDirectoryRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);

  getDirectory(): Observable<AuthorDirectoryView> {
    return this.http
      .get<ApiSuccessEnvelope<AuthorDirectoryView>>(`${this.config.apiBaseUrl}/authors`)
      .pipe(map((response) => response.data));
  }
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import {
  EditableAuthorProfile,
  UpdateEditableAuthorProfile,
} from '../domain/author-profile.models';
import { AuthorProfileRepository } from '../domain/author-profile.repository';

@Injectable()
export class AuthorProfileHttpRepository implements AuthorProfileRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);

  get(): Observable<EditableAuthorProfile> {
    return this.http
      .get<ApiSuccessEnvelope<EditableAuthorProfile>>(`${this.config.apiBaseUrl}/author/profile`)
      .pipe(map((response) => response.data));
  }

  update(input: UpdateEditableAuthorProfile): Observable<EditableAuthorProfile> {
    return this.http
      .patch<ApiSuccessEnvelope<EditableAuthorProfile>>(
        `${this.config.apiBaseUrl}/author/profile`,
        input,
      )
      .pipe(map((response) => response.data));
  }
}

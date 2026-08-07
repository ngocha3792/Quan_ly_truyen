import {
  HttpClient,
} from '@angular/common/http';

import {
  inject,
  Injectable,
} from '@angular/core';

import {
  map,
  Observable,
} from 'rxjs';

import {
  APP_RUNTIME_CONFIG,
} from '../../../../../core/config/app-config.token';

import {
  ApiSuccessEnvelope,
} from '../../../../../core/http/api-envelope.model';

import {
  AccountProfile,
  AccountUiPreferences,
  UpdateAccountProfileRequest,
  UpdateAccountProfileResponse,
} from '../domain/account-profile.models';

@Injectable({
  providedIn: 'root',
})
export class AccountProfileApiService {
  private readonly http =
    inject(HttpClient);

  private readonly config =
    inject(
      APP_RUNTIME_CONFIG,
    );

  private readonly usersUrl =
    `${this.config.apiBaseUrl}/users`;

  getProfile():
    Observable<AccountProfile> {
    return this.http
      .get<
        ApiSuccessEnvelope<AccountProfile>
      >(
        `${this.usersUrl}/me`,
      )
      .pipe(
        map(
          response =>
            response.data,
        ),
      );
  }

  updateProfile(
    request:
      UpdateAccountProfileRequest,
  ): Observable<UpdateAccountProfileResponse> {
    return this.http
      .patch<
        ApiSuccessEnvelope<UpdateAccountProfileResponse>
      >(
        `${this.usersUrl}/me`,

        request,
      )
      .pipe(
        map(
          response =>
            response.data,
        ),
      );
  }

  getPreferences():
    Observable<AccountUiPreferences> {
    return this.http
      .get<
        ApiSuccessEnvelope<AccountUiPreferences>
      >(
        `${this.usersUrl}/me/preferences`,
      )
      .pipe(
        map(
          response =>
            response.data,
        ),
      );
  }

  updatePreferences(
    request:
      Partial<AccountUiPreferences>,
  ): Observable<AccountUiPreferences> {
    return this.http
      .patch<
        ApiSuccessEnvelope<AccountUiPreferences>
      >(
        `${this.usersUrl}/me/preferences`,

        request,
      )
      .pipe(
        map(
          response =>
            response.data,
        ),
      );
  }
}
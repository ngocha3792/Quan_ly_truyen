import {
  HttpClient,
  HttpParams,
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
} from '../../../../core/config/app-config.token';

import {
  ApiSuccessEnvelope,
} from '../../../../core/http/api-envelope.model';

import type {
  AdminUserDetail,
  AdminUserListResponse,
  ManagedUserRoleCode,
  ManagedUserRoleFilter,
  ManagedUserStatus,
  ManagedUserStatusFilter,
} from '../domain/admin-user.models';

@Injectable({
  providedIn:
    'root',
})
export class AdminUsersApiService {
  private readonly http =
    inject(
      HttpClient,
    );

  private readonly config =
    inject(
      APP_RUNTIME_CONFIG,
    );

  private readonly baseUrl =
    `${this.config.apiBaseUrl}/admin/users`;

  list(input: {
    readonly keyword:
      string;

    readonly status:
      ManagedUserStatusFilter;

    readonly role:
      ManagedUserRoleFilter;

    readonly offset:
      number;

    readonly limit:
      number;
  }): Observable<AdminUserListResponse> {
    let params =
      new HttpParams()
        .set(
          'offset',

          String(
            input.offset,
          ),
        )
        .set(
          'limit',

          String(
            input.limit,
          ),
        );

    const keyword =
      input.keyword.trim();

    if (keyword) {
      params =
        params.set(
          'keyword',

          keyword,
        );
    }

    if (
      input.status !==
      'ALL'
    ) {
      params =
        params.set(
          'status',

          input.status,
        );
    }

    if (
      input.role !==
      'ALL'
    ) {
      params =
        params.set(
          'role',

          input.role,
        );
    }

    return this.http
      .get<
        ApiSuccessEnvelope<AdminUserListResponse>
      >(
        this.baseUrl,

        {
          params,
        },
      )
      .pipe(
        map(
          (
            response,
          ) =>
            response.data,
        ),
      );
  }

  getOne(
    userId:
      string,
  ): Observable<AdminUserDetail> {
    return this.http
      .get<
        ApiSuccessEnvelope<AdminUserDetail>
      >(
        `${this.baseUrl}/${userId}`,
      )
      .pipe(
        map(
          (
            response,
          ) =>
            response.data,
        ),
      );
  }

  updateStatus(
    userId:
      string,

    status:
      ManagedUserStatus,
  ): Observable<AdminUserDetail> {
    return this.http
      .patch<
        ApiSuccessEnvelope<AdminUserDetail>
      >(
        `${this.baseUrl}/${userId}/status`,

        {
          status,
        },
      )
      .pipe(
        map(
          (
            response,
          ) =>
            response.data,
        ),
      );
  }

  assignRole(
    userId:
      string,

    roleCode:
      ManagedUserRoleCode,
  ): Observable<AdminUserDetail> {
    return this.http
      .post<
        ApiSuccessEnvelope<AdminUserDetail>
      >(
        `${this.baseUrl}/${userId}/roles`,

        {
          roleCode,
        },
      )
      .pipe(
        map(
          (
            response,
          ) =>
            response.data,
        ),
      );
  }

  removeRole(
    userId:
      string,

    roleCode:
      ManagedUserRoleCode,
  ): Observable<AdminUserDetail> {
    return this.http
      .delete<
        ApiSuccessEnvelope<AdminUserDetail>
      >(
        `${this.baseUrl}/${userId}/roles/${roleCode}`,
      )
      .pipe(
        map(
          (
            response,
          ) =>
            response.data,
        ),
      );
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';

import { inject, Injectable } from '@angular/core';

import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';

import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';

import type {
  AdminUserDetail,
  AdminUserListResponse,
  AdminUserSecurityEvent,
  AdminUserSession,
  ManagedUserRoleCode,
  ManagedUserRoleFilter,
  ManagedUserStatus,
  ManagedUserStatusFilter,
} from '../domain/admin-user.models';

@Injectable({
  providedIn: 'root',
})
export class AdminUsersApiService {
  private readonly http = inject(HttpClient);

  private readonly config = inject(APP_RUNTIME_CONFIG);

  private readonly baseUrl = `${this.config.apiBaseUrl}/admin/users`;

  list(input: {
    readonly keyword: string;

    readonly status: ManagedUserStatusFilter;

    readonly role: ManagedUserRoleFilter;

    readonly offset: number;

    readonly limit: number;
  }): Observable<AdminUserListResponse> {
    let params = new HttpParams()
      .set(
        'offset',

        String(input.offset),
      )
      .set(
        'limit',

        String(input.limit),
      );

    const keyword = input.keyword.trim();

    if (keyword) {
      params = params.set(
        'keyword',

        keyword,
      );
    }

    if (input.status !== 'ALL') {
      params = params.set(
        'status',

        input.status,
      );
    }

    if (input.role !== 'ALL') {
      params = params.set(
        'role',

        input.role,
      );
    }

    return this.http
      .get<ApiSuccessEnvelope<AdminUserListResponse>>(
        this.baseUrl,

        {
          params,
        },
      )
      .pipe(map((response) => response.data));
  }

  getOne(userId: string): Observable<AdminUserDetail> {
    return this.http
      .get<ApiSuccessEnvelope<AdminUserDetail>>(`${this.baseUrl}/${userId}`)
      .pipe(map((response) => response.data));
  }

  updateStatus(
    userId: string,

    status: ManagedUserStatus,

    reason?: string,
  ): Observable<AdminUserDetail> {
    return this.http
      .patch<ApiSuccessEnvelope<AdminUserDetail>>(
        `${this.baseUrl}/${userId}/status`,

        {
          status,
          ...(reason?.trim() ? { reason: reason.trim() } : {}),
        },
      )
      .pipe(map((response) => response.data));
  }

  assignRole(
    userId: string,

    roleCode: ManagedUserRoleCode,
  ): Observable<AdminUserDetail> {
    return this.http
      .post<ApiSuccessEnvelope<AdminUserDetail>>(
        `${this.baseUrl}/${userId}/roles`,

        {
          roleCode,
        },
      )
      .pipe(map((response) => response.data));
  }

  removeRole(
    userId: string,

    roleCode: ManagedUserRoleCode,
  ): Observable<AdminUserDetail> {
    return this.http
      .delete<ApiSuccessEnvelope<AdminUserDetail>>(`${this.baseUrl}/${userId}/roles/${roleCode}`)
      .pipe(map((response) => response.data));
  }

  listSessions(userId: string): Observable<readonly AdminUserSession[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly AdminUserSession[]>>(`${this.baseUrl}/${userId}/sessions`)
      .pipe(map((response) => response.data));
  }

  revokeSession(userId: string, sessionId: string): Observable<{ readonly success: true }> {
    return this.http
      .post<ApiSuccessEnvelope<{ readonly success: true }>>(
        `${this.baseUrl}/${userId}/sessions/${sessionId}/revoke`,
        {},
      )
      .pipe(map((response) => response.data));
  }

  revokeAllSessions(
    userId: string,
  ): Observable<{ readonly success: true; readonly revokedCount: number }> {
    return this.http
      .post<ApiSuccessEnvelope<{ readonly success: true; readonly revokedCount: number }>>(
        `${this.baseUrl}/${userId}/sessions/revoke-all`,
        {},
      )
      .pipe(map((response) => response.data));
  }

  unlock(userId: string): Observable<{ readonly success: true }> {
    return this.http
      .post<ApiSuccessEnvelope<{ readonly success: true }>>(`${this.baseUrl}/${userId}/unlock`, {})
      .pipe(map((response) => response.data));
  }

  listSecurityEvents(userId: string): Observable<readonly AdminUserSecurityEvent[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly AdminUserSecurityEvent[]>>(
        `${this.baseUrl}/${userId}/security-events`,
      )
      .pipe(map((response) => response.data));
  }
}

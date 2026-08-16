import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import type {
  AdminAuditLogDetail,
  AdminAuditLogFilters,
  AdminAuditLogList,
} from '../domain/admin-audit-log.models';

@Injectable({ providedIn: 'root' })
export class AdminAuditLogsApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly url = `${this.config.apiBaseUrl}/admin/audit-logs`;

  list(input: AdminAuditLogFilters = {}): Observable<AdminAuditLogList> {
    let params = new HttpParams()
      .set('page', input.page ?? 1)
      .set('pageSize', input.pageSize ?? 20);

    for (const [key, value] of Object.entries(input)) {
      if (key === 'page' || key === 'pageSize' || value === undefined || value === null || value === '') {
        continue;
      }
      params = params.set(key, String(value));
    }

    return this.http
      .get<ApiSuccessEnvelope<AdminAuditLogList>>(this.url, { params })
      .pipe(map((response) => response.data));
  }

  detail(id: string): Observable<AdminAuditLogDetail> {
    return this.http
      .get<ApiSuccessEnvelope<AdminAuditLogDetail>>(`${this.url}/${encodeURIComponent(id)}`)
      .pipe(map((response) => response.data));
  }
}

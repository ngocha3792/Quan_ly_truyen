import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import type {
  AdminReportDetail,
  AdminReportList,
  AdminReportReason,
  AdminReportStatus,
} from '../domain/admin-report.models';

@Injectable({ providedIn: 'root' })
export class AdminReportsApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly reportsUrl = `${this.config.apiBaseUrl}/admin/reports`;
  private readonly commentsUrl = `${this.config.apiBaseUrl}/admin/comments`;

  list(
    input: {
      status?: AdminReportStatus;
      reason?: AdminReportReason;
      reporter?: string;
      reportedUser?: string;
      createdFrom?: string;
      createdTo?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Observable<AdminReportList> {
    let params = new HttpParams()
      .set('page', input.page ?? 1)
      .set('pageSize', input.pageSize ?? 20)
      .set('sort', 'createdAt')
      .set('direction', 'desc');
    if (input.status) params = params.set('status', input.status);
    if (input.reason) params = params.set('reason', input.reason);
    if (input.reporter) params = params.set('reporter', input.reporter);
    if (input.reportedUser) params = params.set('reportedUser', input.reportedUser);
    if (input.createdFrom) params = params.set('createdFrom', input.createdFrom);
    if (input.createdTo) params = params.set('createdTo', input.createdTo);
    return this.http
      .get<ApiSuccessEnvelope<AdminReportList>>(this.reportsUrl, { params })
      .pipe(map((response) => response.data));
  }

  detail(reportId: string): Observable<AdminReportDetail> {
    return this.http
      .get<ApiSuccessEnvelope<AdminReportDetail>>(
        `${this.reportsUrl}/${encodeURIComponent(reportId)}`,
      )
      .pipe(map((response) => response.data));
  }

  resolve(reportId: string, note: string): Observable<unknown> {
    return this.post(`${this.reportsUrl}/${encodeURIComponent(reportId)}/resolve`, { note });
  }
  reject(reportId: string, note: string): Observable<unknown> {
    return this.post(`${this.reportsUrl}/${encodeURIComponent(reportId)}/reject`, { note });
  }
  moderate(
    commentId: string,
    operation: 'hold' | 'hide' | 'restore' | 'remove',
    reason: string,
    reportId?: string,
  ): Observable<unknown> {
    return this.post(
      `${this.commentsUrl}/${encodeURIComponent(commentId)}/moderation/${operation}`,
      { reason, reportId },
    );
  }
  warn(commentId: string, reason: string, message: string, reportId?: string): Observable<unknown> {
    return this.post(`${this.commentsUrl}/${encodeURIComponent(commentId)}/moderation/warn-user`, {
      reason,
      message,
      reportId,
    });
  }
  ban(commentId: string, reason: string, reportId?: string): Observable<unknown> {
    return this.post(`${this.commentsUrl}/${encodeURIComponent(commentId)}/moderation/ban-user`, {
      reason,
      reportId,
    });
  }

  private post(url: string, body: unknown): Observable<unknown> {
    return this.http
      .post<ApiSuccessEnvelope<unknown>>(url, body, {
        headers: new HttpHeaders({ 'x-idempotency-key': crypto.randomUUID() }),
      })
      .pipe(map((response) => response.data));
  }
}

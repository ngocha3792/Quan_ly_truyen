import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import {
  ManualReviewFilters,
  ManualReviewOrder,
  PageResult,
  PaymentProviderConnection,
  PaymentProviderKindSchema,
  PaymentProviderWrite,
  PaymentReconciliation,
} from '../domain/admin-payment.models';

@Injectable({ providedIn: 'root' })
export class AdminPaymentApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_RUNTIME_CONFIG).apiBaseUrl}/admin/billing`;

  providers() {
    return this.http
      .get<ApiSuccessEnvelope<readonly PaymentProviderConnection[]>>(
        `${this.base}/payment-providers`,
      )
      .pipe(map((r) => r.data));
  }
  kinds() {
    return this.http
      .get<ApiSuccessEnvelope<readonly PaymentProviderKindSchema[]>>(
        `${this.base}/payment-providers/kinds`,
      )
      .pipe(map((r) => r.data));
  }
  createProvider(input: PaymentProviderWrite) {
    return this.http
      .post<ApiSuccessEnvelope<PaymentProviderConnection>>(`${this.base}/payment-providers`, input)
      .pipe(map((r) => r.data));
  }
  updateProvider(id: string, input: Partial<Omit<PaymentProviderWrite, 'code' | 'kind'>>) {
    return this.http
      .patch<ApiSuccessEnvelope<PaymentProviderConnection>>(
        `${this.base}/payment-providers/${id}`,
        input,
      )
      .pipe(map((r) => r.data));
  }
  deleteProvider(id: string) {
    return this.http.delete(`${this.base}/payment-providers/${id}`);
  }
  reviewQueue(filters: ManualReviewFilters, page: number, pageSize: number) {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    // `overdueOnly` cố ý không gửi lên: API không có tham số này, lọc ở client.
    if (filters.status) params = params.set('status', filters.status);
    if (filters.search.trim()) params = params.set('search', filters.search.trim());
    if (filters.provider.trim()) params = params.set('provider', filters.provider.trim());
    if (filters.from) params = params.set('from', `${filters.from}T00:00:00.000Z`);
    if (filters.to) params = params.set('to', `${filters.to}T23:59:59.999Z`);
    return this.http
      .get<ApiSuccessEnvelope<PageResult<ManualReviewOrder>>>(`${this.base}/payment-orders`, {
        params,
      })
      .pipe(map((r) => r.data));
  }

  reconciliation() {
    return this.http
      .get<ApiSuccessEnvelope<PaymentReconciliation>>(`${this.base}/reconciliation`)
      .pipe(map((r) => r.data));
  }
  confirm(id: string, reason: string) {
    return this.review(id, 'confirm', reason);
  }
  reject(id: string, reason: string) {
    return this.review(id, 'reject', reason);
  }

  private review(id: string, action: 'confirm' | 'reject', reason: string) {
    return this.http.post(
      `${this.base}/payment-orders/${id}/${action}`,
      { reason },
      { headers: new HttpHeaders({ 'x-idempotency-key': globalThis.crypto.randomUUID() }) },
    );
  }
}

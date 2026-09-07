import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../core/http/api-envelope.model';
import {
  AdminChapterPurchase,
  AdminPaymentOrder,
  PageResult,
  RevenueAnalytics,
} from './admin-monetization.models';

@Injectable({ providedIn: 'root' })
export class AdminMonetizationApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(APP_RUNTIME_CONFIG).apiBaseUrl;

  paymentOrders(search = ''): Observable<PageResult<AdminPaymentOrder>> {
    const params = this.listParams(search);
    return this.http
      .get<ApiSuccessEnvelope<PageResult<AdminPaymentOrder>>>(
        `${this.apiBaseUrl}/admin/billing/payment-orders`,
        { params },
      )
      .pipe(map((response) => response.data));
  }

  purchases(search = ''): Observable<PageResult<AdminChapterPurchase>> {
    const params = this.listParams(search);
    return this.http
      .get<ApiSuccessEnvelope<PageResult<AdminChapterPurchase>>>(
        `${this.apiBaseUrl}/admin/monetization/purchases`,
        { params },
      )
      .pipe(map((response) => response.data));
  }

  revenue(): Observable<RevenueAnalytics> {
    return this.http
      .get<ApiSuccessEnvelope<RevenueAnalytics>>(`${this.apiBaseUrl}/admin/monetization/revenue`)
      .pipe(map((response) => response.data));
  }

  refundPurchase(purchaseId: string, reason: string): Observable<unknown> {
    return this.http.post(
      `${this.apiBaseUrl}/admin/monetization/purchases/${purchaseId}/refund`,
      { reason },
      { headers: this.idempotencyHeaders() },
    );
  }

  adjustWallet(input: {
    userId: string;
    direction: 'CREDIT' | 'DEBIT';
    amount: string;
    reason: string;
  }): Observable<unknown> {
    return this.http.post(
      `${this.apiBaseUrl}/admin/wallets/${input.userId}/adjustments`,
      {
        direction: input.direction,
        amount: input.amount,
        reason: input.reason,
      },
      { headers: this.idempotencyHeaders() },
    );
  }

  private listParams(search: string): HttpParams {
    let params = new HttpParams().set('page', 1).set('pageSize', 50);
    if (search.trim()) params = params.set('search', search.trim());
    return params;
  }

  private idempotencyHeaders(): HttpHeaders {
    return new HttpHeaders({ 'x-idempotency-key': globalThis.crypto.randomUUID() });
  }
}

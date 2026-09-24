import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import {
  BillingIntegritySummary,
  GatewayFilters,
  GatewayOrder,
  GatewayReconciliation,
  GatewayRefund,
  StoryPaymentAllowlist,
} from '../domain/payment-gateway.models';

@Injectable({ providedIn: 'root' })
export class AdminPaymentGatewayApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_RUNTIME_CONFIG).apiBaseUrl}/admin/billing`;

  orders(filters: GatewayFilters, page: number, pageSize: number) {
    const params: Record<string, string | number> = { page, pageSize };
    if (filters.search.trim()) params['search'] = filters.search.trim();
    if (filters.status) params['status'] = filters.status;
    if (filters.provider.trim()) params['provider'] = filters.provider.trim();
    if (filters.from) params['from'] = `${filters.from}T00:00:00.000Z`;
    if (filters.to) params['to'] = `${filters.to}T23:59:59.999Z`;
    return this.http
      .get<
        ApiSuccessEnvelope<{
          items: readonly GatewayOrder[];
          pagination: { page: number; pageSize: number; totalPages: number; totalItems: number };
        }>
      >(`${this.base}/payment-orders`, { params })
      .pipe(map((response) => response.data));
  }

  integrity() {
    return this.http
      .get<ApiSuccessEnvelope<BillingIntegritySummary>>(`${this.base}/reconciliation`)
      .pipe(map((response) => response.data));
  }

  /** Ghi nhận lệnh chuyển trả admin đã tự thực hiện, cho cổng không có API hoàn tiền. */
  refundManually(
    orderId: string,
    reason: string,
    transferReference: string,
    idempotencyKey: string,
  ) {
    return this.http
      .post<ApiSuccessEnvelope<GatewayRefund>>(
        `${this.base}/payment-orders/${orderId}/refunds/manual`,
        { reason, transferReference },
        { headers: new HttpHeaders({ 'x-idempotency-key': idempotencyKey }) },
      )
      .pipe(map((response) => response.data));
  }

  reconcile(orderId: string) {
    return this.http
      .post<ApiSuccessEnvelope<GatewayReconciliation>>(
        `${this.base}/payment-orders/${orderId}/reconcile`,
        {},
      )
      .pipe(map((response) => response.data));
  }

  refunds(orderId: string) {
    return this.http
      .get<ApiSuccessEnvelope<readonly GatewayRefund[]>>(
        `${this.base}/payment-orders/${orderId}/refunds`,
      )
      .pipe(map((response) => response.data));
  }

  refund(orderId: string, reason: string, idempotencyKey: string) {
    return this.http
      .post<ApiSuccessEnvelope<GatewayRefund>>(
        `${this.base}/payment-orders/${orderId}/refunds`,
        { reason },
        { headers: new HttpHeaders({ 'x-idempotency-key': idempotencyKey }) },
      )
      .pipe(map((response) => response.data));
  }

  allowlist(storyId: string) {
    return this.http
      .get<ApiSuccessEnvelope<StoryPaymentAllowlist>>(`${this.base}/story-allowlists/${storyId}`)
      .pipe(map((response) => response.data));
  }

  saveAllowlist(storyId: string, input: StoryPaymentAllowlist) {
    return this.http
      .put<ApiSuccessEnvelope<StoryPaymentAllowlist>>(
        `${this.base}/story-allowlists/${storyId}`,
        input,
      )
      .pipe(map((response) => response.data));
  }
}

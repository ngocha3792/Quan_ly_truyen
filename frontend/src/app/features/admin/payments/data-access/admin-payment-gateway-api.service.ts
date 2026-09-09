import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import {
  GatewayOrder,
  GatewayReconciliation,
  GatewayRefund,
  StoryPaymentAllowlist,
} from '../domain/payment-gateway.models';

@Injectable({ providedIn: 'root' })
export class AdminPaymentGatewayApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_RUNTIME_CONFIG).apiBaseUrl}/admin/billing`;

  orders(page: number, search: string) {
    return this.http
      .get<
        ApiSuccessEnvelope<{
          items: readonly GatewayOrder[];
          pagination: { totalPages: number; totalItems: number };
        }>
      >(`${this.base}/payment-orders`, {
        params: { page, pageSize: 20, ...(search.trim() ? { search: search.trim() } : {}) },
      })
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

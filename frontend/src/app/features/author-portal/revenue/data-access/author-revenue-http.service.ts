import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import {
  AuthorRevenueSummary,
  CreatePayoutAccountInput,
  PayoutAccount,
  PayoutRequest,
} from '../../../../core/revenue/revenue.models';

@Injectable({ providedIn: 'root' })
export class AuthorRevenueHttpService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_RUNTIME_CONFIG).apiBaseUrl}/author/revenue`;

  summary() {
    return this.get<AuthorRevenueSummary>('earnings');
  }
  payoutAccounts() {
    return this.get<{ items: readonly PayoutAccount[] }>('payout-accounts').pipe(
      map((r) => r.items),
    );
  }
  payoutRequests() {
    return this.get<{ items: readonly PayoutRequest[] }>('payout-requests').pipe(
      map((r) => r.items),
    );
  }
  createPayoutAccount(input: CreatePayoutAccountInput) {
    return this.post<PayoutAccount>('payout-accounts', input);
  }
  updateAccount(id: string, input: { isPrimary?: boolean; isActive?: boolean }) {
    return this.http
      .patch<ApiSuccessEnvelope<PayoutAccount>>(
        `${this.base}/payout-accounts/${encodeURIComponent(id)}`,
        input,
      )
      .pipe(map((r) => r.data));
  }
  createPayoutRequest(input: { accountId: string; grossAmount: string }, key: string) {
    return this.post<PayoutRequest>('payout-requests', input, key);
  }
  cancelPayout(id: string) {
    return this.post<PayoutRequest>(`payout-requests/${encodeURIComponent(id)}/cancel`, {});
  }
  private get<T>(path: string) {
    return this.http.get<ApiSuccessEnvelope<T>>(`${this.base}/${path}`).pipe(map((r) => r.data));
  }
  private post<T>(path: string, body: unknown, key: string = globalThis.crypto.randomUUID()) {
    return this.http
      .post<ApiSuccessEnvelope<T>>(`${this.base}/${path}`, body, {
        headers: new HttpHeaders({ 'x-idempotency-key': key }),
      })
      .pipe(map((r) => r.data));
  }
}

import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import {
  PayoutAccount,
  PayoutBatch,
  PayoutRequest,
  RevenuePolicy,
} from '../../../../core/revenue/revenue.models';
import {
  RevenueAgreement,
  RevenueAgreementInput,
  RevenueReconciliation,
} from '../domain/admin-revenue.models';

@Injectable({ providedIn: 'root' })
export class AdminRevenueHttpService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_RUNTIME_CONFIG).apiBaseUrl}/admin/revenue`;
  policy() {
    return this.get<RevenuePolicy>('policy');
  }
  savePolicy(input: RevenuePolicy) {
    const body = {
      enabled: input.enabled,
      settlementDelayDays: input.settlementDelayDays,
      minimumPayoutCredits: input.minimumPayoutCredits,
      feeBasisPoints: input.feeBasisPoints,
      taxBasisPoints: input.taxBasisPoints,
      fiatMinorPerCredit: input.fiatMinorPerCredit,
      minimumPlatformFeeBasisPoints: input.minimumPlatformFeeBasisPoints,
      platformUserId: input.platformUserId,
    };
    return this.http
      .put<ApiSuccessEnvelope<RevenuePolicy>>(`${this.base}/policy`, body, {
        headers: this.headers(),
      })
      .pipe(map((r) => r.data));
  }
  accounts() {
    return this.get<{ items: readonly PayoutAccount[] }>('payout-accounts').pipe(
      map((r) => r.items),
    );
  }
  reviewAccount(id: string, input: { verified: boolean; reference: string }) {
    return this.post(`payout-accounts/${encodeURIComponent(id)}/review`, input);
  }
  requests() {
    return this.get<{ items: readonly PayoutRequest[] }>('payout-requests').pipe(
      map((r) => r.items),
    );
  }
  batches() {
    return this.get<{ items: readonly PayoutBatch[] }>('payout-batches').pipe(map((r) => r.items));
  }
  createBatch(requestIds: readonly string[]) {
    return this.post('payout-batches', { requestIds });
  }
  exportBatch(id: string) {
    return this.get<unknown>(`payout-batches/${encodeURIComponent(id)}/export`);
  }
  complete(id: string, input: { providerTxnId: string; evidenceReference: string }) {
    return this.post(`payout-requests/${encodeURIComponent(id)}/complete`, input);
  }
  fail(id: string, input: { reason: string; evidenceReference: string }) {
    return this.post(`payout-requests/${encodeURIComponent(id)}/fail`, input);
  }
  reconciliation() {
    return this.get<RevenueReconciliation>('reconciliation');
  }
  agreements(storyId: string) {
    return this.http
      .get<ApiSuccessEnvelope<readonly RevenueAgreement[]>>(`${this.base}/agreements`, {
        params: new HttpParams().set('storyId', storyId),
      })
      .pipe(map((r) => r.data));
  }
  createAgreement(input: RevenueAgreementInput) {
    return this.post<RevenueAgreement>('agreements', input);
  }
  private get<T>(path: string) {
    return this.http.get<ApiSuccessEnvelope<T>>(`${this.base}/${path}`).pipe(map((r) => r.data));
  }
  private post<T = unknown>(path: string, body: unknown) {
    return this.http
      .post<ApiSuccessEnvelope<T>>(`${this.base}/${path}`, body, { headers: this.headers() })
      .pipe(map((r) => r.data));
  }
  private headers() {
    return new HttpHeaders({ 'x-idempotency-key': globalThis.crypto.randomUUID() });
  }
}

import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../../core/http/api-envelope.model';
import {
  CreatePaymentOrderResult,
  CreditPackage,
  CreditWallet,
  PaymentOrderPage,
} from '../domain/credit.models';

@Injectable({ providedIn: 'root' })
export class CreditApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly billingUrl = `${this.config.apiBaseUrl}/billing`;

  wallet(): Observable<CreditWallet> {
    return this.http
      .get<ApiSuccessEnvelope<CreditWallet>>(`${this.config.apiBaseUrl}/wallet/me`)
      .pipe(map((response) => response.data));
  }

  packages(): Observable<readonly CreditPackage[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly CreditPackage[]>>(`${this.billingUrl}/credit-packages`)
      .pipe(map((response) => response.data));
  }

  orders(page = 1, pageSize = 10): Observable<PaymentOrderPage> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http
      .get<ApiSuccessEnvelope<PaymentOrderPage>>(`${this.billingUrl}/top-up-orders/me`, {
        params,
      })
      .pipe(map((response) => response.data));
  }

  createOrder(packageId: string, idempotencyKey: string): Observable<CreatePaymentOrderResult> {
    return this.http
      .post<ApiSuccessEnvelope<CreatePaymentOrderResult>>(
        `${this.billingUrl}/top-up-orders`,
        { packageId },
        { headers: new HttpHeaders({ 'x-idempotency-key': idempotencyKey }) },
      )
      .pipe(map((response) => response.data));
  }
}

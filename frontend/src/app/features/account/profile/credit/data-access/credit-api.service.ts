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
  PaymentMethod,
  PaymentOrder,
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

  paymentMethods(storyId?: string): Observable<readonly PaymentMethod[]> {
    return this.http
      .get<ApiSuccessEnvelope<readonly PaymentMethod[]>>(`${this.billingUrl}/payment-methods`, {
        params: storyId ? { storyId } : {},
      })
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

  createOrder(
    packageId: string,
    idempotencyKey: string,
    providerConnectionId?: string,
    storyId?: string,
  ): Observable<CreatePaymentOrderResult> {
    return this.http
      .post<ApiSuccessEnvelope<CreatePaymentOrderResult>>(
        `${this.billingUrl}/top-up-orders`,
        {
          packageId,
          ...(providerConnectionId ? { providerConnectionId } : {}),
          ...(storyId ? { storyId } : {}),
        },
        { headers: new HttpHeaders({ 'x-idempotency-key': idempotencyKey }) },
      )
      .pipe(map((response) => response.data));
  }

  order(orderId: string): Observable<PaymentOrder> {
    return this.http
      .get<ApiSuccessEnvelope<PaymentOrder>>(`${this.billingUrl}/top-up-orders/${orderId}`)
      .pipe(map((response) => response.data));
  }

  markTransferred(
    orderId: string,
    input: { referenceCode?: string; note?: string },
  ): Observable<PaymentOrder> {
    return this.http
      .post<ApiSuccessEnvelope<PaymentOrder>>(
        `${this.billingUrl}/top-up-orders/${orderId}/transfer-claim`,
        input,
        { headers: new HttpHeaders({ 'x-idempotency-key': globalThis.crypto.randomUUID() }) },
      )
      .pipe(map((response) => response.data));
  }
}

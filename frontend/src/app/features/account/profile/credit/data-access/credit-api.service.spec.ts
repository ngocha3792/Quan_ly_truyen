import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_RUNTIME_CONFIG } from '../../../../../core/config/app-config.token';
import { CreditApiService } from './credit-api.service';

describe('CreditApiService', () => {
  let service: CreditApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CreditApiService,
        {
          provide: APP_RUNTIME_CONFIG,
          useValue: { apiBaseUrl: '/api/v1', appName: 'TruyenHub', production: false },
        },
      ],
    });
    service = TestBed.inject(CreditApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('creates an order with the supplied retry-stable idempotency key', async () => {
    const resultPromise = firstValueFrom(service.createOrder('package-id', 'retry-key-123'));
    const request = http.expectOne('/api/v1/billing/top-up-orders');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ packageId: 'package-id' });
    expect(request.request.headers.get('x-idempotency-key')).toBe('retry-key-123');
    request.flush(successEnvelope({ order: { id: 'order-id' }, replayed: false }));

    await expect(resultPromise).resolves.toEqual({
      order: { id: 'order-id' },
      replayed: false,
    });
  });

  it('loads only the signed-in user payment history', async () => {
    const resultPromise = firstValueFrom(service.orders(2, 5));
    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/v1/billing/top-up-orders/me' &&
        candidate.params.get('page') === '2' &&
        candidate.params.get('pageSize') === '5',
    );

    expect(request.request.method).toBe('GET');
    request.flush(successEnvelope({ items: [], pagination: {} }));
    await resultPromise;
  });
});

function successEnvelope<T>(data: T) {
  return {
    success: true as const,
    data,
    requestId: 'billing-request',
    timestamp: '2026-09-07T00:00:00.000Z',
  };
}

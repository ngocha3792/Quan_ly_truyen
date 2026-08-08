import { provideHttpClient } from '@angular/common/http';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TestBed } from '@angular/core/testing';

import { firstValueFrom } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../../../../../core/config/app-config.token';

import { AccountSecurityApiService } from './account-security-api.service';

describe('AccountSecurityApiService', () => {
  let service: AccountSecurityApiService;

  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),

        provideHttpClientTesting(),

        {
          provide: APP_RUNTIME_CONFIG,

          useValue: {
            apiBaseUrl: '/api/v1',

            appName: 'TruyenHub',

            production: false,
          },
        },
      ],
    });

    service = TestBed.inject(AccountSecurityApiService);

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();

    TestBed.resetTestingModule();
  });

  it('change-email phải gửi idempotency key', async () => {
    const promise = firstValueFrom(
      service.requestEmailChange({
        newEmail: 'new@truyenhub.test',

        currentPassword: 'Password@123',
      }),
    );

    const request = http.expectOne('/api/v1/auth/change-email');

    expect(request.request.method).toBe('POST');

    expect(request.request.body).toEqual({
      newEmail: 'new@truyenhub.test',

      currentPassword: 'Password@123',
    });

    expect(request.request.headers.get('x-idempotency-key')).toBeTruthy();

    request.flush({
      success: true,

      data: {
        emailChangeRequested: true,

        pendingEmail: 'new@truyenhub.test',

        verificationRequired: true,

        expiresAt: '2026-08-07T13:00:00.000Z',
      },

      requestId: 'request-test',

      timestamp: '2026-08-07T12:00:00.000Z',
    });

    const result = await promise;

    expect(result.pendingEmail).toBe('new@truyenhub.test');
  });
});

import { provideHttpClient } from '@angular/common/http';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TestBed } from '@angular/core/testing';

import { firstValueFrom } from 'rxjs';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';

import { AdminAuthorApplicationRecord } from '../domain/admin-author-application.models';

import { AdminAuthorApplicationsApiService } from './admin-author-applications-api.service';

describe('AdminAuthorApplicationsApiService', () => {
  let api: AdminAuthorApplicationsApiService;

  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),

        provideHttpClientTesting(),

        AdminAuthorApplicationsApiService,

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

    api = TestBed.inject(AdminAuthorApplicationsApiService);

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();

    TestBed.resetTestingModule();
  });

  it('approve phải gửi chính xác idempotency key do ActionsStore cung cấp', async () => {
    const promise = firstValueFrom(
      api.approve(
        'application-1',

        'approve-operation-key',
      ),
    );

    const request = http.expectOne('/api/v1/author-applications/admin/application-1/approve');

    expect(request.request.method).toBe('POST');

    expect(request.request.body).toEqual({});

    expect(request.request.headers.get('x-idempotency-key')).toBe('approve-operation-key');

    request.flush(successEnvelope(application('APPROVED')));

    const result = await promise;

    expect(result.status).toBe('APPROVED');
  });

  it('reject phải trim reason nhưng giữ nguyên idempotency key được cung cấp', async () => {
    const promise = firstValueFrom(
      api.reject(
        'application-1',

        '  Mẫu nội dung chưa đáp ứng tiêu chí xét duyệt.  ',

        'reject-operation-key',
      ),
    );

    const request = http.expectOne('/api/v1/author-applications/admin/application-1/reject');

    expect(request.request.method).toBe('POST');

    expect(request.request.body).toEqual({
      reason: 'Mẫu nội dung chưa đáp ứng tiêu chí xét duyệt.',
    });

    expect(request.request.headers.get('x-idempotency-key')).toBe('reject-operation-key');

    request.flush(successEnvelope(application('REJECTED')));

    const result = await promise;

    expect(result.status).toBe('REJECTED');
  });
});

function successEnvelope(data: AdminAuthorApplicationRecord) {
  return {
    success: true as const,

    data,

    requestId: 'phase-3-request',

    timestamp: '2026-08-09T00:00:00.000Z',
  };
}

function application(status: 'APPROVED' | 'REJECTED'): AdminAuthorApplicationRecord {
  return {
    applicationId: 'application-1',

    userId: 'applicant-1',

    status,

    penName: 'API Pen',

    fullName: 'API Applicant',

    email: 'api@example.test',

    phone: '0900000000',

    portfolioUrl: null,

    primaryGenre: 'Fantasy',

    experience: '1-3-years',

    introduction: 'Introduction',

    firstWorkSynopsis: 'Synopsis',

    acceptedTerms: true,

    sample: null,

    submittedAt: '2026-08-08T12:00:00.000Z',

    reviewedAt: '2026-08-08T13:00:00.000Z',

    reviewedById: 'reviewer-a',

    rejectionReason: status === 'REJECTED' ? 'Mẫu nội dung chưa đáp ứng tiêu chí xét duyệt.' : null,

    createdAt: '2026-08-08T11:00:00.000Z',

    updatedAt: '2026-08-08T13:00:00.000Z',
  };
}

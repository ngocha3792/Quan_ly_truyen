import { provideHttpClient } from '@angular/common/http';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TestBed } from '@angular/core/testing';

import { firstValueFrom, of } from 'rxjs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';

import { AuthorApplicationApiRepository } from './author-application-api.repository';

import { AuthorApplicationUploadService } from './author-application-upload.service';

describe('AuthorApplicationApiRepository', () => {
  let repository: AuthorApplicationApiRepository;

  let http: HttpTestingController;

  let upload: {
    uploadSample: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    upload = {
      uploadSample: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),

        provideHttpClientTesting(),

        AuthorApplicationApiRepository,

        {
          provide: AuthorApplicationUploadService,

          useValue: upload,
        },

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

    repository = TestBed.inject(AuthorApplicationApiRepository);

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();

    TestBed.resetTestingModule();
  });

  it('retry submit cùng file phải reuse confirmed media và cùng idempotency key', async () => {
    upload.uploadSample.mockReturnValue(
      of({
        id: 'media-1',

        status: 'READY',

        deliveryUrl: 'https://example.test/sample.pdf',
      }),
    );

    const file = new File(
      ['author sample'],

      'sample.pdf',

      {
        type: 'application/pdf',

        lastModified: 1_700_000_000_000,
      },
    );

    const payload = createPayload(file);

    /*
     * FIRST ATTEMPT
     */
    const firstPromise = firstValueFrom(repository.submit(payload));

    const firstDraft = http.expectOne('/api/v1/author-applications/me/draft');

    expect(firstDraft.request.method).toBe('PUT');

    firstDraft.flush(successEnvelope(application('DRAFT')));

    expect(upload.uploadSample).toHaveBeenCalledTimes(1);

    const firstSubmit = http.expectOne('/api/v1/author-applications/me/submit');

    const firstKey = firstSubmit.request.headers.get('x-idempotency-key');

    expect(firstKey).toBeTruthy();

    /*
     * Giả lập server/network failure
     * sau media đã confirm.
     */
    firstSubmit.flush(
      {
        message: 'temporary error',
      },

      {
        status: 500,

        statusText: 'Server Error',
      },
    );

    await expect(firstPromise).rejects.toBeDefined();

    /*
     * SECOND ATTEMPT
     */
    const secondPromise = firstValueFrom(repository.submit(payload));

    const secondDraft = http.expectOne('/api/v1/author-applications/me/draft');

    secondDraft.flush(successEnvelope(application('DRAFT')));

    /*
     * Không được upload lại.
     */
    expect(upload.uploadSample).toHaveBeenCalledTimes(1);

    const secondSubmit = http.expectOne('/api/v1/author-applications/me/submit');

    const secondKey = secondSubmit.request.headers.get('x-idempotency-key');

    /*
     * Cùng business operation
     * => cùng idempotency key.
     */
    expect(secondKey).toBe(firstKey);

    expect(secondSubmit.request.body).toEqual({
      applicationId: 'application-1',

      sampleMediaId: 'media-1',
    });

    secondSubmit.flush(successEnvelope(application('PENDING')));

    const result = await secondPromise;

    expect(result.status).toBe('PENDING');
  });
});

function createPayload(sampleFile: File) {
  return {
    penName: 'Retry Pen',

    fullName: 'Retry Author',

    email: 'retry@example.test',

    phone: '0900000000',

    portfolioUrl: 'https://example.test',

    primaryGenre: 'Fantasy',

    experience: '1-3-years',

    introduction: 'Retry integration description',

    firstWorkSynopsis: 'Retry synopsis',

    acceptedTerms: true,

    sampleFile,
  };
}

function application(status: 'DRAFT' | 'PENDING') {
  return {
    applicationId: 'application-1',

    userId: 'user-1',

    status,

    penName: 'Retry Pen',

    fullName: 'Retry Author',

    email: 'retry@example.test',

    phone: '0900000000',

    portfolioUrl: 'https://example.test',

    primaryGenre: 'Fantasy',

    experience: '1-3-years',

    introduction: 'Retry integration description',

    firstWorkSynopsis: 'Retry synopsis',

    acceptedTerms: true,

    sampleFileName: 'sample.pdf',

    sample:
      status === 'PENDING'
        ? {
            id: 'media-1',

            fileName: 'sample.pdf',

            mimeType: 'application/pdf',

            sizeBytes: '10',

            url: 'https://example.test/sample.pdf',
          }
        : null,

    submittedAt: status === 'PENDING' ? '2026-08-08T12:00:00.000Z' : null,

    reviewedAt: null,

    reviewedById: null,

    rejectionReason: null,

    createdAt: '2026-08-08T11:00:00.000Z',

    updatedAt: '2026-08-08T12:00:00.000Z',
  };
}

function successEnvelope<T>(data: T) {
  return {
    success: true as const,

    data,

    requestId: 'test-request',

    timestamp: '2026-08-08T12:00:00.000Z',
  };
}

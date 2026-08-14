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

  it('replay submit trực tiếp khi backend đã commit nhưng response bị mất', async () => {
    upload.uploadSample.mockReturnValue(of(media('media-1')));

    const file = sampleFile('author sample');

    const payload = createPayload(file);

    /*
     * FIRST ATTEMPT
     */
    const firstPromise = firstValueFrom(repository.submit(payload));

    const firstDraft = await waitForRequest(http, '/api/v1/author-applications/me/draft');

    expect(firstDraft.request.method).toBe('PUT');

    firstDraft.flush(successEnvelope(application('DRAFT')));

    expect(upload.uploadSample).toHaveBeenCalledTimes(1);

    const firstSubmit = await waitForRequest(http, '/api/v1/author-applications/me/submit');

    const firstKey = firstSubmit.request.headers.get('x-idempotency-key');

    expect(firstKey).toBeTruthy();

    /*
     * Backend có thể đã commit application -> PENDING,
     * nhưng connection bị mất trước khi response tới browser.
     */
    firstSubmit.error(new ProgressEvent('error'));

    await expect(firstPromise).rejects.toBeDefined();

    /*
     * SECOND ATTEMPT
     *
     * Không được saveDraft lại.
     */
    const secondPromise = firstValueFrom(repository.submit(payload));

    const secondSubmit = await waitForRequest(http, '/api/v1/author-applications/me/submit');

    http.expectNone('/api/v1/author-applications/me/draft');

    /*
     * Không upload sample lại.
     */
    expect(upload.uploadSample).toHaveBeenCalledTimes(1);

    const secondKey = secondSubmit.request.headers.get('x-idempotency-key');

    /*
     * Phải dùng chính xác key của operation cũ.
     */
    expect(secondKey).toBe(firstKey);

    expect(secondSubmit.request.body).toEqual({
      applicationId: 'application-1',

      sampleMediaId: 'media-1',
    });

    /*
     * Backend idempotency middleware trả lại kết quả
     * của request đã commit trước đó.
     */
    secondSubmit.flush(successEnvelope(application('PENDING')));

    const result = await secondPromise;

    expect(result.status).toBe('PENDING');
  });

  it('giữ direct replay khi idempotency request cũ vẫn đang được xử lý', async () => {
    upload.uploadSample.mockReturnValue(of(media('media-1')));

    const file = sampleFile('author sample');

    const payload = createPayload(file);

    /*
     * FIRST REQUEST
     */
    const firstPromise = firstValueFrom(repository.submit(payload));

    const firstDraft = await waitForRequest(http, '/api/v1/author-applications/me/draft');

    firstDraft.flush(successEnvelope(application('DRAFT')));

    const firstSubmit = await waitForRequest(http, '/api/v1/author-applications/me/submit');

    const firstKey = firstSubmit.request.headers.get('x-idempotency-key');

    /*
     * Browser mất connection.
     */
    firstSubmit.error(new ProgressEvent('error'));

    await expect(firstPromise).rejects.toBeDefined();

    /*
     * SECOND REQUEST
     *
     * Direct replay.
     */
    const secondPromise = firstValueFrom(repository.submit(payload));

    const secondSubmit = await waitForRequest(http, '/api/v1/author-applications/me/submit');

    http.expectNone('/api/v1/author-applications/me/draft');

    expect(secondSubmit.request.headers.get('x-idempotency-key')).toBe(firstKey);

    /*
     * Request đầu vẫn đang được idempotency middleware xử lý.
     */
    secondSubmit.flush(idempotencyConflictEnvelope(), {
      status: 409,

      statusText: 'Conflict',
    });

    await expect(secondPromise).rejects.toBeDefined();

    /*
     * THIRD REQUEST
     *
     * Phải tiếp tục replay cùng operation,
     * không quay lại saveDraft.
     */
    const thirdPromise = firstValueFrom(repository.submit(payload));

    const thirdSubmit = await waitForRequest(http, '/api/v1/author-applications/me/submit');

    http.expectNone('/api/v1/author-applications/me/draft');

    expect(thirdSubmit.request.headers.get('x-idempotency-key')).toBe(firstKey);

    expect(upload.uploadSample).toHaveBeenCalledTimes(1);

    thirdSubmit.flush(successEnvelope(application('PENDING')));

    await expect(thirdPromise).resolves.toMatchObject({
      status: 'PENDING',
    });
  });

  it('coi form khác whitespace nhưng cùng normalized data là cùng operation', async () => {
    upload.uploadSample.mockReturnValue(of(media('media-1')));

    const firstFile = sampleFile('same content', 1_700_000_000_000);

    const firstPayload = createPayload(firstFile);

    const firstPromise = firstValueFrom(repository.submit(firstPayload));

    const firstDraft = await waitForRequest(http, '/api/v1/author-applications/me/draft');

    firstDraft.flush(successEnvelope(application('DRAFT')));

    const firstSubmit = await waitForRequest(http, '/api/v1/author-applications/me/submit');

    const firstKey = firstSubmit.request.headers.get('x-idempotency-key');

    firstSubmit.error(new ProgressEvent('error'));

    await expect(firstPromise).rejects.toBeDefined();

    /*
     * File object mới,
     * lastModified khác,
     * nhưng bytes giống.
     */
    const retryFile = sampleFile('same content', 1_800_000_000_000);

    /*
     * Form chỉ khác whitespace.
     */
    const retryPayload = {
      ...createPayload(retryFile),

      penName: '  Retry Pen  ',

      introduction: '  Retry integration description  ',
    };

    const retryPromise = firstValueFrom(repository.submit(retryPayload));

    const retrySubmit = await waitForRequest(http, '/api/v1/author-applications/me/submit');

    /*
     * Không saveDraft lại.
     */
    http.expectNone('/api/v1/author-applications/me/draft');

    /*
     * Không upload lại.
     */
    expect(upload.uploadSample).toHaveBeenCalledTimes(1);

    /*
     * Cùng business operation
     * => cùng idempotency key.
     */
    expect(retrySubmit.request.headers.get('x-idempotency-key')).toBe(firstKey);

    retrySubmit.flush(successEnvelope(application('PENDING')));

    await expect(retryPromise).resolves.toMatchObject({
      status: 'PENDING',
    });
  });

  it('không replay key cũ khi normalized form data thay đổi', async () => {
    upload.uploadSample.mockReturnValue(of(media('media-1')));

    const file = sampleFile('same content');

    const firstPromise = firstValueFrom(repository.submit(createPayload(file)));

    const firstDraft = await waitForRequest(http, '/api/v1/author-applications/me/draft');

    firstDraft.flush(successEnvelope(application('DRAFT')));

    const firstSubmit = await waitForRequest(http, '/api/v1/author-applications/me/submit');

    const firstKey = firstSubmit.request.headers.get('x-idempotency-key');

    firstSubmit.error(new ProgressEvent('error'));

    await expect(firstPromise).rejects.toBeDefined();

    /*
     * Thay đổi business data thật.
     */
    const changedPayload = {
      ...createPayload(file),

      penName: 'Different Pen',
    };

    const secondPromise = firstValueFrom(repository.submit(changedPayload));

    /*
     * Không được direct replay.
     *
     * Phải persist draft mới trước.
     */
    const secondDraft = await waitForRequest(http, '/api/v1/author-applications/me/draft');

    expect(secondDraft.request.body).toMatchObject({
      penName: 'Different Pen',
    });

    secondDraft.flush(successEnvelope(application('DRAFT')));

    /*
     * File không đổi => media reuse.
     */
    expect(upload.uploadSample).toHaveBeenCalledTimes(1);

    const secondSubmit = await waitForRequest(http, '/api/v1/author-applications/me/submit');

    const secondKey = secondSubmit.request.headers.get('x-idempotency-key');

    /*
     * Operation mới bắt buộc key mới.
     */
    expect(secondKey).toBeTruthy();

    expect(secondKey).not.toBe(firstKey);

    secondSubmit.flush(successEnvelope(application('PENDING')));

    await expect(secondPromise).resolves.toMatchObject({
      status: 'PENDING',
    });
  });

  it('không replay khi file có cùng metadata nhưng content SHA-256 khác', async () => {
    upload.uploadSample
      .mockReturnValueOnce(of(media('media-1')))
      .mockReturnValueOnce(of(media('media-2')));

    /*
     * Hai file có cùng:
     *
     * name
     * type
     * size
     * lastModified
     *
     * nhưng bytes khác.
     */
    const firstFile = sampleFile('AAAA');

    const changedFile = sampleFile('BBBB');

    expect(firstFile.name).toBe(changedFile.name);

    expect(firstFile.type).toBe(changedFile.type);

    expect(firstFile.size).toBe(changedFile.size);

    expect(firstFile.lastModified).toBe(changedFile.lastModified);

    const firstPromise = firstValueFrom(repository.submit(createPayload(firstFile)));

    const firstDraft = await waitForRequest(http, '/api/v1/author-applications/me/draft');

    firstDraft.flush(successEnvelope(application('DRAFT')));

    const firstSubmit = await waitForRequest(http, '/api/v1/author-applications/me/submit');

    const firstKey = firstSubmit.request.headers.get('x-idempotency-key');

    firstSubmit.error(new ProgressEvent('error'));

    await expect(firstPromise).rejects.toBeDefined();

    const secondPromise = firstValueFrom(repository.submit(createPayload(changedFile)));

    /*
     * SHA-256 khác nên đây là operation mới.
     *
     * Không được direct replay.
     */
    const secondDraft = await waitForRequest(http, '/api/v1/author-applications/me/draft');

    secondDraft.flush(successEnvelope(application('DRAFT')));

    /*
     * File mới thực sự
     * => upload lại.
     */
    expect(upload.uploadSample).toHaveBeenCalledTimes(2);

    expect(upload.uploadSample).toHaveBeenLastCalledWith(
      'application-1',

      changedFile,
    );

    const secondSubmit = await waitForRequest(http, '/api/v1/author-applications/me/submit');

    const secondKey = secondSubmit.request.headers.get('x-idempotency-key');

    /*
     * Không được reuse key của File A.
     */
    expect(secondKey).not.toBe(firstKey);

    expect(secondSubmit.request.body).toEqual({
      applicationId: 'application-1',

      sampleMediaId: 'media-2',
    });

    secondSubmit.flush(successEnvelope(application('PENDING')));

    await expect(secondPromise).resolves.toMatchObject({
      status: 'PENDING',
    });
  });
});

async function waitForRequest(http: HttpTestingController, url: string) {
  await new Promise((resolve) => setTimeout(resolve, 50));

  return http.expectOne(url);
}

function media(id: string) {
  return {
    id,

    status: 'READY',

    deliveryUrl: `https://example.test/${id}.pdf`,
  };
}

function sampleFile(
  content: string,

  lastModified = 1_700_000_000_000,
): File {
  return new File([content], 'sample.pdf', {
    type: 'application/pdf',

    lastModified,
  });
}

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

function idempotencyConflictEnvelope() {
  return {
    success: false as const,

    error: {
      code: 'IDEMPOTENCY_CONFLICT',
      message: 'Yêu cầu trùng lặp đang được xử lý',
      retryable: false,
    },

    requestId: 'test-request',

    timestamp: '2026-08-08T12:00:00.000Z',

    path: '/api/v1/author-applications/me/submit',
  };
}

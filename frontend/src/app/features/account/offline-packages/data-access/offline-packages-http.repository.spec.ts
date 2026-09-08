import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { OfflinePackageSummary } from '../domain/offline-package.models';
import { OfflinePackagesHttpRepository } from './offline-packages-http.repository';

describe('OfflinePackagesHttpRepository', () => {
  let repository: OfflinePackagesHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        OfflinePackagesHttpRepository,
        {
          provide: APP_RUNTIME_CONFIG,
          useValue: { apiBaseUrl: '/api/v1' },
        },
      ],
    });
    repository = TestBed.inject(OfflinePackagesHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('creates an offline package with an explicit idempotency key', async () => {
    const resultPromise = firstValueFrom(
      repository.createPackage({
        name: 'Cuối tuần',
        description: 'Ba chương mới',
        chapterIds: ['chapter-1', 'chapter-2'],
        idempotencyKey: 'offline-create-request-12345678',
      }),
    );
    const request = http.expectOne('/api/v1/offline-packages');

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('x-idempotency-key')).toBe(
      'offline-create-request-12345678',
    );
    expect(request.request.body).toEqual({
      name: 'Cuối tuần',
      description: 'Ba chương mới',
      chapterIds: ['chapter-1', 'chapter-2'],
    });
    request.flush(successEnvelope(packageSummary()));

    await expect(resultPromise).resolves.toEqual(packageSummary());
  });

  it('loads quota before treating byte values as presentation data', async () => {
    const resultPromise = firstValueFrom(repository.getQuota());
    const request = http.expectOne('/api/v1/offline-packages/quota');
    expect(request.request.method).toBe('GET');
    request.flush(
      successEnvelope({
        maxPackages: 5,
        maxTotalSizeBytes: '524288000',
        maxChaptersPerPackage: 50,
        currentPackages: 1,
        currentSizeBytes: '1048576',
        remainingPackages: 4,
        remainingSizeBytes: '523239424',
      }),
    );

    await expect(resultPromise).resolves.toMatchObject({ currentSizeBytes: '1048576' });
  });
});

function packageSummary(): OfflinePackageSummary {
  return {
    id: 'package-1',
    deviceId: 'device-1',
    name: 'Cuối tuần',
    description: 'Ba chương mới',
    status: 'READY',
    totalSizeBytes: '1048576',
    chapterCount: 2,
    licenseExpiresAt: '2026-10-08T00:00:00.000Z',
    lastAccessedAt: '2026-09-08T00:00:00.000Z',
    autoDeleteAt: '2026-12-07T00:00:00.000Z',
    revokedAt: null,
    revokedReason: null,
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z',
  };
}

function successEnvelope<T>(data: T) {
  return {
    success: true as const,
    data,
    requestId: 'offline-test-request',
    timestamp: '2026-09-08T00:00:00.000Z',
  };
}

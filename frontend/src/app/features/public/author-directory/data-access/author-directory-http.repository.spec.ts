import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { AuthorDirectoryView } from '../domain/author-directory.models';
import { AuthorDirectoryHttpRepository } from './author-directory-http.repository';

describe('AuthorDirectoryHttpRepository', () => {
  let repository: AuthorDirectoryHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthorDirectoryHttpRepository,
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

    repository = TestBed.inject(AuthorDirectoryHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('loads authors from the public authors endpoint', async () => {
    const view: AuthorDirectoryView = {
      authors: [],
      statistics: {
        authors: '0',
        works: '0',
        reads: '0',
        followers: '0',
      },
      newAuthors: [],
    };
    const resultPromise = firstValueFrom(repository.getDirectory());
    const request = http.expectOne('/api/v1/authors');

    expect(request.request.method).toBe('GET');
    request.flush(successEnvelope(view));

    await expect(resultPromise).resolves.toEqual(view);
  });
});

function successEnvelope<T>(data: T) {
  return {
    success: true as const,
    data,
    requestId: 'phase-7-request',
    timestamp: '2026-08-15T00:00:00.000Z',
  };
}

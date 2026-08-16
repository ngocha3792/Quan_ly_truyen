import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { AuthorDetailView } from '../domain/author-detail.models';
import { AuthorDetailHttpRepository } from './author-detail-http.repository';

describe('AuthorDetailHttpRepository', () => {
  let repository: AuthorDetailHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthorDetailHttpRepository,
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

    repository = TestBed.inject(AuthorDetailHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('loads the requested author slug from the API', async () => {
    const view = detailView();
    const resultPromise = firstValueFrom(repository.getBySlug('but danh'));
    const request = http.expectOne('/api/v1/authors/but%20danh');

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

function detailView(): AuthorDetailView {
  return {
    profile: {
      id: 'author-id',
      slug: 'but-danh',
      name: 'Bút Danh',
      initials: 'BD',
      headline: 'Tác giả TruyenHub',
      country: 'Không công khai',
      penName: 'Bút Danh',
      joinedAt: '2026',
      verified: true,
      avatarUrl: null,
      bannerUrl: null,
      socialLinks: {
        website: null,
        facebook: null,
        instagram: null,
        x: null,
        youtube: null,
        tiktok: null,
      },
      biography: ['Tiểu sử'],
    },
    statistics: {
      totalWorks: 0,
      followers: '0',
      followersCount: 0,
      totalReads: '0',
      averageRating: '0.0/10',
    },
    featuredWorks: [],
    timeline: [],
    recentUpdates: [],
    hotWorks: [],
  };
}

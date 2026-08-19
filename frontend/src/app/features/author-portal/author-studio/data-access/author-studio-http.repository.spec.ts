import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { AuthorStudioDashboard } from '../domain/author-studio.models';
import { AuthorStudioHttpRepository } from './author-studio-http.repository';

describe('AuthorStudioHttpRepository', () => {
  let repository: AuthorStudioHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthorStudioHttpRepository,
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

    repository = TestBed.inject(AuthorStudioHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('loads dashboard data from the authenticated author endpoint', async () => {
    const dashboard = dashboardView();
    const resultPromise = firstValueFrom(repository.getDashboard());
    const request = http.expectOne('/api/v1/author/dashboard');

    expect(request.request.method).toBe('GET');
    request.flush(successEnvelope(dashboard));

    await expect(resultPromise).resolves.toEqual(dashboard);
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

function dashboardView(): AuthorStudioDashboard {
  return {
    profile: {
      displayName: 'Author',
      penName: 'Pen',
      avatarUrl: '/assets/images/avatar-placeholder.svg',
      verified: true,
    },
    unreadNotifications: 0,
    metrics: [],
    readership: {
      '7d': [],
      '30d': [],
      '90d': [],
    },
    schedule: [],
    stories: [],
    drafts: [],
    comments: [],
    topStories: [],
    monthlyGoals: [],
  };
}

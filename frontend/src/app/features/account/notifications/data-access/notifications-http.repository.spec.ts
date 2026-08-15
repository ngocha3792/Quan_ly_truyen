import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { NotificationsView } from '../domain/notifications.models';
import { NotificationsHttpRepository } from './notifications-http.repository';

describe('NotificationsHttpRepository', () => {
  let repository: NotificationsHttpRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        NotificationsHttpRepository,
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

    repository = TestBed.inject(NotificationsHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('loads notification view from the authenticated API', async () => {
    const view = notificationView();
    const resultPromise = firstValueFrom(repository.getNotifications());
    const request = http.expectOne('/api/v1/notifications');

    expect(request.request.method).toBe('GET');
    request.flush(successEnvelope(view));

    await expect(resultPromise).resolves.toEqual(view);
  });

  it('persists read state instead of mutating mock data', async () => {
    const resultPromise = firstValueFrom(repository.setRead('notification-id', true));
    const request = http.expectOne('/api/v1/notifications/notification-id/read');

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ value: true });
    request.flush(null);

    await resultPromise;
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

function notificationView(): NotificationsView {
  return {
    notifications: [],
    statistics: {
      total: 0,
      unread: 0,
      saved: 0,
      receivedToday: 0,
    },
    settings: {
      newChapters: true,
      comments: true,
      system: true,
      promotions: true,
    },
    recentActivities: [],
  };
}

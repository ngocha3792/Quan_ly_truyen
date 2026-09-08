import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';

import type { AuthSessionLifecycleEvent } from '../auth/auth-session-lifecycle.service';
import { AuthSessionLifecycleService } from '../auth/auth-session-lifecycle.service';
import { AuthStore } from '../auth/auth.store';
import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import { ServiceWorkerRegistrationService } from '../pwa/service-worker-registration.service';
import { OfflineConnectivityService } from './offline-connectivity.service';
import { OfflineDbService } from './offline-db.service';
import { OfflineSessionCoordinatorService } from './offline-session-coordinator.service';
import type { OfflineStorageScope } from './offline.models';

describe('OfflineSessionCoordinatorService', () => {
  let changes: Subject<AuthSessionLifecycleEvent>;
  let onlineChanges: Subject<boolean>;
  const lifecycleScope = signal<OfflineStorageScope | null>(null);
  const activeScope = signal<OfflineStorageScope | null>(null);
  const online = signal(true);
  const authenticated = signal(true);
  const database = {
    activeScope: activeScope.asReadonly(),
    activateScope: vi.fn(async (scope: OfflineStorageScope) => {
      activeScope.set(scope);
      return false;
    }),
    restoreStoredScope: vi.fn(async () => {
      const scope = { userId: 'user-local', sessionId: 'session-local' };
      activeScope.set(scope);
      return scope;
    }),
    deactivateAndClear: vi.fn(async () => activeScope.set(null)),
    cleanup: vi.fn(async () => ({
      removedPackageIds: [],
      removedAssetUrls: [],
      freedBytes: 0,
    })),
    listPackages: vi.fn(async () => []),
    deletePackage: vi.fn(async () => null),
    savePackage: vi.fn(async () => undefined),
  };
  const serviceWorker = {
    setPrivateScope: vi.fn(async () => undefined),
    clearPrivateCaches: vi.fn(async () => undefined),
    removeManifestAssets: vi.fn(async () => 0),
  };
  const httpGet = vi.fn(() => of({ success: true, data: [] }));

  beforeEach(() => {
    changes = new Subject<AuthSessionLifecycleEvent>();
    onlineChanges = new Subject<boolean>();
    lifecycleScope.set(null);
    activeScope.set(null);
    online.set(true);
    authenticated.set(true);
    localStorage.clear();
    vi.clearAllMocks();
    httpGet.mockReturnValue(of({ success: true, data: [] }));

    TestBed.configureTestingModule({
      providers: [
        OfflineSessionCoordinatorService,
        {
          provide: AuthSessionLifecycleService,
          useValue: { scope: lifecycleScope.asReadonly(), changes$: changes.asObservable() },
        },
        { provide: AuthStore, useValue: { isAuthenticated: authenticated.asReadonly() } },
        { provide: OfflineDbService, useValue: database },
        { provide: ServiceWorkerRegistrationService, useValue: serviceWorker },
        {
          provide: OfflineConnectivityService,
          useValue: { online: online.asReadonly(), onlineChanges$: onlineChanges.asObservable() },
        },
        {
          provide: HttpClient,
          useValue: { get: httpGet },
        },
        {
          provide: APP_RUNTIME_CONFIG,
          useValue: runtimeConfig(),
        },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('restores the persisted owner immediately during a cold-start offline race', async () => {
    const service = TestBed.inject(OfflineSessionCoordinatorService);
    service.initialize();

    await expect(service.ensureOfflineScope()).resolves.toBe(true);
    expect(database.restoreStoredScope).toHaveBeenCalledTimes(1);
    expect(activeScope()).toEqual({ userId: 'user-local', sessionId: 'session-local' });
  });

  it('clears IDB, private caches and legacy progress on clear/invalidate', async () => {
    const service = TestBed.inject(OfflineSessionCoordinatorService);
    service.initialize();
    localStorage.setItem('qlt:reading-progress:pending:user:story', '{}');

    changes.next(lifecycleEvent('session-cleared'));
    await service.whenSettled();
    expect(database.deactivateAndClear).toHaveBeenCalledTimes(1);
    expect(serviceWorker.clearPrivateCaches).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('qlt:reading-progress:pending:user:story')).toBeNull();

    changes.next(lifecycleEvent('session-invalidated'));
    await service.whenSettled();
    expect(database.deactivateAndClear).toHaveBeenCalledTimes(2);
  });

  it('does not clear licensed offline data after temporary access loss', async () => {
    const service = TestBed.inject(OfflineSessionCoordinatorService);
    service.initialize();

    changes.next(lifecycleEvent('access-lost'));
    await service.whenSettled();

    expect(database.deactivateAndClear).not.toHaveBeenCalled();
    expect(serviceWorker.clearPrivateCaches).not.toHaveBeenCalled();
  });

  it('reconciles within four minutes while the authenticated app is visible', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    activeScope.set({ userId: 'user-1', sessionId: 'session-1' });
    const service = TestBed.inject(OfflineSessionCoordinatorService);
    service.initialize();

    await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
    await service.whenSettled();

    expect(httpGet).toHaveBeenCalledWith('/api/v1/offline-packages');
    vi.useRealTimers();
  });
});

function lifecycleEvent(kind: AuthSessionLifecycleEvent['kind']): AuthSessionLifecycleEvent {
  return { kind, scope: null, reason: 'test', remote: false, revision: 1 };
}

function runtimeConfig() {
  return {
    apiBaseUrl: '/api/v1',
    appName: 'TruyenHub',
    production: false,
    features: {
      monetizationEnabled: false,
      paymentProviderEnabled: false,
      contentDocumentEnabled: true,
      portableCursorEnabled: true,
      realtimeProgressSyncEnabled: true,
      inlineCommentsEnabled: false,
      comicDeliveryEnabled: true,
      offlineReadingEnabled: true,
    },
    passwordPolicy: {
      minimumLength: 8,
      maximumLength: 72,
      maximumBytes: 72,
      requireLowercase: true,
      requireUppercase: true,
      requireNumber: true,
      requireSymbol: false,
    },
    passwordReset: { tokenExpiresInMinutes: 30 },
    csrf: { enabled: false, cookieName: 'csrf', headerName: 'x-csrf' },
  };
}

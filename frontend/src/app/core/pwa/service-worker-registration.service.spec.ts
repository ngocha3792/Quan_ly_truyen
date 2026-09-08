import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import { OfflineConnectivityService } from '../offline/offline-connectivity.service';
import { ServiceWorkerRegistrationService } from './service-worker-registration.service';

describe('ServiceWorkerRegistrationService private cache scope', () => {
  it('stops sending later asset chunks if the account scope changes mid-operation', async () => {
    const service = createService();
    const internals = service as unknown as {
      privateScopeHash: string;
      sendCommand: (command: {
        readonly type: string;
        readonly scopeHash: string;
        readonly assets: string[];
      }) => Promise<{ cached: number }>;
    };
    internals.privateScopeHash = 'a'.repeat(64);
    let calls = 0;
    internals.sendCommand = vi.fn(async (command) => {
      calls += 1;
      if (calls === 1) internals.privateScopeHash = 'b'.repeat(64);
      return { cached: command.assets.length };
    });
    const assets = Array.from(
      { length: 501 },
      (_, index) => `https://cdn.example.com/page-${index}.webp`,
    );

    await expect(service.cacheManifestAssets(assets)).resolves.toBe(250);
    expect(internals.sendCommand).toHaveBeenCalledTimes(1);
  });
});

function createService(): ServiceWorkerRegistrationService {
  TestBed.configureTestingModule({
    providers: [
      ServiceWorkerRegistrationService,
      { provide: PLATFORM_ID, useValue: 'browser' },
      {
        provide: APP_RUNTIME_CONFIG,
        useValue: { production: false, apiBaseUrl: '/api/v1' },
      },
      {
        provide: OfflineConnectivityService,
        useValue: {
          markUpdateAvailable: vi.fn(),
          markUpdateApplied: vi.fn(),
          updateAvailable: signal(false).asReadonly(),
        },
      },
    ],
  });
  return TestBed.inject(ServiceWorkerRegistrationService);
}

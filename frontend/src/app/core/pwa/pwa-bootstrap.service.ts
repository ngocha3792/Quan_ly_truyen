import { inject, Injectable } from '@angular/core';

import { OfflineConnectivityService } from '../offline/offline-connectivity.service';
import { OfflineSessionCoordinatorService } from '../offline/offline-session-coordinator.service';
import { OfflineSyncService } from '../offline/offline-sync.service';
import { ServiceWorkerRegistrationService } from './service-worker-registration.service';

@Injectable({ providedIn: 'root' })
export class PwaBootstrapService {
  private readonly connectivity = inject(OfflineConnectivityService);
  private readonly registration = inject(ServiceWorkerRegistrationService);
  private readonly sessionCoordinator = inject(OfflineSessionCoordinatorService);
  private readonly sync = inject(OfflineSyncService);
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.connectivity.initialize();
    this.sessionCoordinator.initialize();
    this.sync.initialize();
    void this.registration.register();
  }
}

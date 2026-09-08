import { inject, Injectable } from '@angular/core';

import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { OfflineConnectivityService } from '../../../../core/offline/offline-connectivity.service';
import { OfflineSyncService } from '../../../../core/offline/offline-sync.service';
import type { ProgressUpdateEvent } from './reading-progress-sync.events';

@Injectable()
export class ReadingProgressOfflineQueueService {
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly connectivity = inject(OfflineConnectivityService);
  private readonly sync = inject(OfflineSyncService);

  constructor() {
    this.connectivity.initialize();
    this.sync.initialize();
  }

  online(): boolean {
    return this.connectivity.online();
  }

  enqueue(event: ProgressUpdateEvent): void {
    if (!this.config.features.offlineReadingEnabled) return;
    void this.sync.queueProgress(event).catch(() => undefined);
  }
}

import { inject, Injectable } from '@angular/core';

import { ServiceWorkerRegistrationService } from '../pwa/service-worker-registration.service';
import { OfflineDbService } from './offline-db.service';
import type {
  OfflineChapterBundle,
  OfflineCleanupResult,
  OfflinePackageEntry,
  OfflinePackageRecord,
} from './offline.models';
import { OfflineSessionCoordinatorService } from './offline-session-coordinator.service';

@Injectable({ providedIn: 'root' })
export class OfflineLibraryService {
  private readonly database = inject(OfflineDbService);
  private readonly serviceWorker = inject(ServiceWorkerRegistrationService);
  private readonly sessionCoordinator = inject(OfflineSessionCoordinatorService);

  async deletePackage(packageId: string): Promise<boolean> {
    const existing = await this.database.getPackage(packageId);
    if (!existing) return false;
    if (existing.assetUrls.length) {
      await this.serviceWorker.removeManifestAssets(existing.assetUrls);
    }
    return (await this.database.deletePackage(packageId)) !== null;
  }

  async isDownloaded(packageId: string): Promise<boolean> {
    if (!(await this.sessionCoordinator.ensureOfflineScope())) return false;
    return this.database.isDownloaded(packageId);
  }

  async listPackages(): Promise<readonly OfflinePackageRecord[]> {
    if (!(await this.sessionCoordinator.ensureOfflineScope())) return [];
    return this.database.listPackages();
  }

  async getChapter(
    storySlug: string,
    chapterNumber: number | string,
  ): Promise<OfflineChapterBundle | null> {
    if (!(await this.sessionCoordinator.ensureOfflineScope())) return null;
    return this.database.getOfflineChapter(storySlug, chapterNumber);
  }

  async getPackageEntry(packageId: string): Promise<OfflinePackageEntry | null> {
    if (!(await this.sessionCoordinator.ensureOfflineScope())) return null;
    return this.database.getPackageEntry(packageId);
  }

  async cleanup(): Promise<OfflineCleanupResult> {
    const result = await this.database.cleanup();
    if (result.removedAssetUrls.length) {
      await this.serviceWorker.removeManifestAssets(result.removedAssetUrls);
    }
    return result;
  }
}

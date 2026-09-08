import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import type { ApiSuccessEnvelope } from '../http/api-envelope.model';
import { ServiceWorkerRegistrationService } from '../pwa/service-worker-registration.service';
import { OfflineDbService } from './offline-db.service';
import {
  assertOfflineManifestUsable,
  fetchOfflineAsset,
  offlineDownloadProgress,
  OfflineDownloadProgressTracker,
  offlineMediaMimeType,
  offlineManifestSnapshotMatches,
  selectOfflineSliceAsset,
  serializedOfflineSize,
  throwIfOfflineDownloadAborted,
  toStoredOfflineChapter,
} from './offline-download.helpers';
import { parseOfflinePackageManifest } from './offline-manifest.parser';
import { OfflineLibraryService } from './offline-library.service';
import type {
  OfflineChapterBundle,
  OfflineCleanupResult,
  OfflineDownloadOptions,
  OfflineMediaRecord,
  OfflinePackageEntry,
  OfflinePackageRecord,
  OfflineStorageScope,
  OfflineStoredMedia,
} from './offline.models';
import { OfflinePackageUnavailableError, OfflineStorageScopeError } from './offline.models';
import { offlineByteStringToNumber } from './offline-storage.policy';

const RESERVATION_TTL_MS = 10 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class OfflineDownloadService {
  private readonly database = inject(OfflineDbService);
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly serviceWorker = inject(ServiceWorkerRegistrationService);
  private readonly library = inject(OfflineLibraryService);
  private readonly inFlight = new Map<string, Promise<OfflinePackageRecord>>();
  private readonly progressTracker = new OfflineDownloadProgressTracker();

  readonly progress = this.progressTracker.progress;

  downloadPackage(
    packageId: string,
    options: OfflineDownloadOptions = {},
  ): Promise<OfflinePackageRecord> {
    const normalizedId = packageId.trim();
    if (!normalizedId) return Promise.reject(new Error('Package ID không hợp lệ.'));
    const scope = this.database.activeScope();
    if (!scope) return Promise.reject(new OfflineStorageScopeError());
    const requestKey = `${scope.userId}:${scope.sessionId}:${normalizedId}`;

    const existing = this.inFlight.get(requestKey);
    if (existing) return existing;

    const request = this.performDownload(normalizedId, options, scope).finally(() => {
      this.inFlight.delete(requestKey);
      if (this.scopeMatches(scope)) {
        this.progressTracker.update(normalizedId, null, options.onProgress);
      }
    });
    this.inFlight.set(requestKey, request);
    return request;
  }

  async deletePackage(packageId: string): Promise<boolean> {
    return this.library.deletePackage(packageId);
  }

  async isDownloaded(packageId: string): Promise<boolean> {
    return this.library.isDownloaded(packageId);
  }

  async listLocalPackages(): Promise<readonly OfflinePackageRecord[]> {
    return this.library.listPackages();
  }

  async getOfflineChapter(
    storySlug: string,
    chapterNumber: number | string,
  ): Promise<OfflineChapterBundle | null> {
    return this.library.getChapter(storySlug, chapterNumber);
  }

  async getPackageEntry(packageId: string): Promise<OfflinePackageEntry | null> {
    return this.library.getPackageEntry(packageId);
  }

  async cleanup(): Promise<OfflineCleanupResult> {
    return this.library.cleanup();
  }

  private async performDownload(
    packageId: string,
    options: OfflineDownloadOptions,
    scope: OfflineStorageScope,
  ): Promise<OfflinePackageRecord> {
    if (!this.config.features.offlineReadingEnabled) {
      throw new OfflinePackageUnavailableError('Tính năng đọc offline đang tắt.');
    }

    this.assertScope(scope);
    throwIfOfflineDownloadAborted(options.signal);
    this.progressTracker.update(
      packageId,
      offlineDownloadProgress(packageId, 'preparing', 0, 1),
      options.onProgress,
    );

    const envelope = await firstValueFrom(
      this.http.get<ApiSuccessEnvelope<unknown>>(
        `${this.config.apiBaseUrl}/offline-packages/${encodeURIComponent(packageId)}/manifest`,
      ),
    );
    this.assertScope(scope);
    const manifest = parseOfflinePackageManifest(envelope.data);
    if (manifest.packageId !== packageId) {
      throw new OfflinePackageUnavailableError('Package ID trong manifest không khớp yêu cầu.');
    }
    assertOfflineManifestUsable(manifest.status, manifest.licenseExpiresAt);

    const declaredBytes = offlineByteStringToNumber(manifest.totalSizeBytes);
    const existing = await this.database.getPackage(packageId);
    this.assertScope(scope);
    if (existing?.assetUrls.length) {
      await this.serviceWorker.removeManifestAssets(existing.assetUrls);
      this.assertScope(scope);
    }

    const selectedAssets = manifest.chapters.flatMap((chapter) =>
      chapter.media.flatMap((media) =>
        media.slices.map((slice) => selectOfflineSliceAsset(slice.urls)),
      ),
    );
    const timestamp = new Date().toISOString();
    const reservationId = crypto.randomUUID();
    let prepared = false;
    let downloadedBytes = 0;
    const total = Math.max(
      1,
      manifest.chapters.length +
        manifest.chapters.reduce(
          (sum, chapter) =>
            sum + chapter.media.reduce((mediaSum, media) => mediaSum + media.slices.length, 0),
          0,
        ),
    );
    let completed = 0;

    const pendingPackage: OfflinePackageRecord = {
      id: manifest.packageId,
      name: manifest.name,
      description: manifest.description,
      status: manifest.status,
      downloadState: 'DOWNLOADING',
      licenseExpiresAt: manifest.licenseExpiresAt,
      createdAt: manifest.createdAt,
      chapterIds: manifest.chapters.map((chapter) => chapter.chapterId),
      assetUrls: selectedAssets,
      chapterCount: manifest.chapterCount,
      totalSizeBytes: declaredBytes,
      downloadedBytes: 0,
      downloadedAt: timestamp,
      lastAccessedAt: timestamp,
      reservationId,
      reservationExpiresAt: new Date(Date.now() + RESERVATION_TTL_MS).toISOString(),
    };

    try {
      const cleanup = await this.database.reservePackage(pendingPackage);
      this.assertScope(scope);
      prepared = true;
      if (cleanup.removedAssetUrls.length) {
        await this.serviceWorker.removeManifestAssets(cleanup.removedAssetUrls);
        this.assertScope(scope);
      }
      await this.serviceWorker.cacheManifestAssets(selectedAssets);
      this.assertScope(scope);

      for (const chapter of manifest.chapters) {
        throwIfOfflineDownloadAborted(options.signal);
        const storedMedia: OfflineStoredMedia[] = [];

        for (const media of chapter.media) {
          const storedSlices = [];
          for (const slice of media.slices) {
            throwIfOfflineDownloadAborted(options.signal);
            const originalUrl = selectOfflineSliceAsset(slice.urls);
            const blob = await fetchOfflineAsset(originalUrl, options.signal);
            this.assertScope(scope);
            const mediaStorageId = `${media.mediaAssetId}:${slice.id}`;
            const mediaRecord: OfflineMediaRecord = {
              id: mediaStorageId,
              packageId: manifest.packageId,
              chapterId: chapter.chapterId,
              mediaAssetId: media.mediaAssetId,
              sliceId: slice.id,
              originalUrl,
              mimeType: blob.type || offlineMediaMimeType(originalUrl),
              width: slice.width,
              height: slice.height,
              sizeBytes: blob.size,
              blob,
            };
            await this.database.saveReservedMedia(mediaRecord, reservationId);
            this.assertScope(scope);
            downloadedBytes += blob.size;
            storedSlices.push({
              id: slice.id,
              mediaStorageId,
              sliceIndex: slice.sliceIndex,
              width: slice.width,
              height: slice.height,
              offsetY: slice.offsetY,
              aspectRatio: slice.aspectRatio,
            });
            completed += 1;
            this.progressTracker.update(
              packageId,
              offlineDownloadProgress(packageId, 'media', completed, total),
              options.onProgress,
            );
          }
          storedMedia.push({
            mediaAssetId: media.mediaAssetId,
            sortOrder: media.sortOrder,
            altText: media.altText,
            caption: media.caption,
            width: media.width,
            height: media.height,
            slices: storedSlices,
          });
        }

        const storedChapter = toStoredOfflineChapter(manifest.packageId, chapter, storedMedia);
        await this.database.saveReservedChapter(storedChapter, reservationId);
        this.assertScope(scope);
        downloadedBytes += serializedOfflineSize(storedChapter);
        completed += 1;
        this.progressTracker.update(
          packageId,
          offlineDownloadProgress(packageId, 'content', completed, total),
          options.onProgress,
        );
      }

      this.progressTracker.update(
        packageId,
        offlineDownloadProgress(packageId, 'finalizing', total, total),
        options.onProgress,
      );
      const verificationEnvelope = await firstValueFrom(
        this.http.get<ApiSuccessEnvelope<unknown>>(
          `${this.config.apiBaseUrl}/offline-packages/${encodeURIComponent(packageId)}/manifest`,
        ),
      );
      this.assertScope(scope);
      const verification = parseOfflinePackageManifest(verificationEnvelope.data);
      assertOfflineManifestUsable(verification.status, verification.licenseExpiresAt);
      if (!offlineManifestSnapshotMatches(manifest, verification)) {
        throw new OfflinePackageUnavailableError(
          'Gói offline đã thay đổi trong lúc tải. Vui lòng tải lại.',
        );
      }
      await this.serviceWorker.removeManifestAssets(selectedAssets);
      this.assertScope(scope);
      const ready = await this.database.markPackageReady(packageId, downloadedBytes, reservationId);
      this.assertScope(scope);
      return ready;
    } catch (error) {
      if (selectedAssets.length && this.scopeMatches(scope)) {
        await this.serviceWorker.removeManifestAssets(selectedAssets).catch(() => 0);
      }
      if (prepared && this.scopeMatches(scope)) {
        await this.database.deleteReservedPackage(packageId, reservationId).catch(() => null);
      }
      throw error;
    }
  }

  private assertScope(expected: OfflineStorageScope): void {
    if (!this.scopeMatches(expected))
      throw new OfflineStorageScopeError('Phiên đã đổi khi đang tải.');
  }

  private scopeMatches(expected: OfflineStorageScope): boolean {
    const current = this.database.activeScope();
    return current?.userId === expected.userId && current.sessionId === expected.sessionId;
  }
}

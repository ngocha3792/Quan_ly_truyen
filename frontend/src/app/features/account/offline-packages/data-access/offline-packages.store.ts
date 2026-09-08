import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, firstValueFrom, forkJoin } from 'rxjs';

import { OfflineDbService } from '../../../../core/offline/offline-db.service';
import { OfflineDownloadService } from '../../../../core/offline/offline-download.service';
import type { OfflineDownloadProgress } from '../../../../core/offline/offline.models';
import type { OfflinePackageRecord } from '../../../../core/offline/offline.models';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  LocalStorageEstimate,
  offlinePackageIdsToPurge,
  OfflinePackageSummary,
  OfflineQuota,
  PackageDownloadProgress,
} from '../domain/offline-package.models';
import { OfflinePackagesRepository } from '../domain/offline-packages.repository';

@Injectable()
export class OfflinePackagesStore {
  private readonly repository = inject(OfflinePackagesRepository);
  private readonly offlineDb = inject(OfflineDbService);
  private readonly downloader = inject(OfflineDownloadService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly serverPackagesState = signal<readonly OfflinePackageSummary[]>([]);
  private readonly localPackagesState = signal<readonly OfflinePackageSummary[]>([]);

  readonly packages = computed(() =>
    mergePackageSources(this.serverPackagesState(), this.localPackagesState()),
  );
  readonly quota = signal<OfflineQuota | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);

  readonly localPackageIds = computed(() => this.localPackagesState().map((item) => item.id));
  readonly localStorage = signal<LocalStorageEstimate | null>(null);
  readonly downloadProgress = signal<Readonly<Record<string, PackageDownloadProgress>>>({});
  readonly busyPackageIds = signal<readonly string[]>([]);

  readonly maxChapters = computed(() => this.quota()?.maxChaptersPerPackage ?? 50);
  readonly packageLimitReached = computed(() => {
    const quota = this.quota();
    return quota ? quota.remainingPackages <= 0 || Number(quota.remainingSizeBytes) <= 0 : true;
  });

  loadServerData(): void {
    this.loadDashboard();
  }

  loadLocalData(): void {
    void this.refreshLocalState();
  }

  refresh(): void {
    this.clearMessages();
    this.loadDashboard();
    void this.refreshLocalState();
  }

  acceptCreated(created: OfflinePackageSummary): void {
    this.serverPackagesState.update((current) => [created, ...current]);
    this.message.set(
      created.status === 'READY'
        ? 'Gói đã sẵn sàng để tải về thiết bị.'
        : 'Gói đang được máy chủ chuẩn bị.',
    );
    this.reloadQuota();
  }

  async downloadPackage(packageId: string): Promise<void> {
    if (this.downloadProgress()[packageId] || this.isBusy(packageId)) return;
    this.clearMessages();
    this.setBusy(packageId, true);
    try {
      await this.downloader.downloadPackage(packageId, {
        onProgress: (progress) => this.setDownloadProgress(progress),
      });
      this.message.set('Đã tải gói xuống thiết bị.');
      await this.refreshLocalState();
    } catch (error: unknown) {
      this.error.set(getApiErrorMessage(error, 'Không thể tải gói xuống thiết bị.'));
    } finally {
      this.clearDownloadProgress(packageId);
      this.setBusy(packageId, false);
    }
  }

  async removeLocalPackage(packageId: string): Promise<void> {
    if (this.isBusy(packageId)) return;
    this.clearMessages();
    this.setBusy(packageId, true);
    try {
      await this.downloader.deletePackage(packageId);
      this.message.set('Đã xóa bản tải trên thiết bị.');
      await this.refreshLocalState();
    } catch (error: unknown) {
      this.error.set(getApiErrorMessage(error, 'Không thể xóa bản tải trên thiết bị.'));
    } finally {
      this.setBusy(packageId, false);
    }
  }

  deleteServerPackage(offlinePackage: OfflinePackageSummary): void {
    if (this.isBusy(offlinePackage.id)) return;
    this.clearMessages();
    this.setBusy(offlinePackage.id, true);
    this.repository
      .deletePackage(offlinePackage.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.setBusy(offlinePackage.id, false)),
      )
      .subscribe({
        next: () => {
          this.serverPackagesState.update((current) =>
            current.filter((item) => item.id !== offlinePackage.id),
          );
          this.message.set('Đã xóa gói khỏi tài khoản.');
          void this.downloader
            .deletePackage(offlinePackage.id)
            .then(() => this.refreshLocalState())
            .catch(() => this.refreshLocalState());
          this.reloadQuota();
        },
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Không thể xóa gói offline.')),
      });
  }

  async getPackageEntryRoute(
    packageId: string,
  ): Promise<{ readonly storySlug: string; readonly chapterNumber: number } | null> {
    return this.downloader.getPackageEntry(packageId);
  }

  async touchServerPackage(packageId: string): Promise<void> {
    try {
      await firstValueFrom(this.repository.touchPackage(packageId));
    } catch {
      // Local access remains valid when the best-effort LRU touch cannot reach the server.
    }
  }

  reportError(message: string): void {
    this.error.set(message);
    this.message.set(null);
  }

  reportMessage(message: string): void {
    this.message.set(message);
    this.error.set(null);
  }

  clearMessages(): void {
    this.error.set(null);
    this.message.set(null);
  }

  private loadDashboard(): void {
    if (this.loading()) return;
    this.loading.set(true);
    forkJoin({ packages: this.repository.listPackages(), quota: this.repository.getQuota() })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: ({ packages, quota }) => {
          this.serverPackagesState.set(packages);
          this.quota.set(quota);
          void this.reconcileLocalPackages(packages);
        },
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Không thể tải các gói offline.')),
      });
  }

  private reloadQuota(): void {
    this.repository
      .getQuota()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (quota) => this.quota.set(quota) });
  }

  private async refreshLocalState(): Promise<void> {
    try {
      const [packages, estimate] = await Promise.all([
        this.downloader.listLocalPackages(),
        this.offlineDb.estimateStorage(),
      ]);
      this.localPackagesState.set(
        packages
          .filter((item) => item.downloadState === 'READY')
          .map((item) => toLocalPackageSummary(item)),
      );
      this.localStorage.set({
        usageBytes: estimate.offlineBytes,
        quotaBytes: estimate.offlineBudgetBytes,
      });
    } catch {
      this.localPackagesState.set([]);
      this.localStorage.set(null);
    }
  }

  private async reconcileLocalPackages(
    serverPackages: readonly OfflinePackageSummary[],
  ): Promise<void> {
    try {
      const localPackages = await this.downloader.listLocalPackages();
      const staleLocalIds = offlinePackageIdsToPurge(
        serverPackages,
        localPackages.map((item) => item.id),
      );

      await Promise.all(staleLocalIds.map((packageId) => this.downloader.deletePackage(packageId)));
      await this.refreshLocalState();
    } catch {
      // Session cleanup may race this reconciliation. The coordinator remains authoritative.
    }
  }

  private setDownloadProgress(progress: OfflineDownloadProgress): void {
    const phaseLabels: Record<OfflineDownloadProgress['phase'], string> = {
      preparing: 'Đang chuẩn bị',
      content: 'Đang lưu nội dung',
      media: 'Đang tải hình ảnh',
      finalizing: 'Đang hoàn tất',
    };
    this.downloadProgress.update((current) => ({
      ...current,
      [progress.packageId]: {
        completed: progress.completed,
        total: progress.total,
        percent: Math.round(progress.percent),
        phase: phaseLabels[progress.phase],
      },
    }));
  }

  private clearDownloadProgress(packageId: string): void {
    this.downloadProgress.update((current) => {
      const next = { ...current };
      delete next[packageId];
      return next;
    });
  }

  private isBusy(packageId: string): boolean {
    return this.busyPackageIds().includes(packageId);
  }

  private setBusy(packageId: string, busy: boolean): void {
    this.busyPackageIds.update((current) => {
      const next = current.filter((id) => id !== packageId);
      return busy ? [...next, packageId] : next;
    });
  }
}

function mergePackageSources(
  serverPackages: readonly OfflinePackageSummary[],
  localPackages: readonly OfflinePackageSummary[],
): readonly OfflinePackageSummary[] {
  const serverIds = new Set(serverPackages.map((item) => item.id));
  return [...serverPackages, ...localPackages.filter((item) => !serverIds.has(item.id))];
}

function toLocalPackageSummary(record: OfflinePackageRecord): OfflinePackageSummary {
  return {
    id: record.id,
    deviceId: null,
    name: record.name,
    description: record.description,
    status: record.status,
    totalSizeBytes: String(record.totalSizeBytes),
    chapterCount: record.chapterCount,
    licenseExpiresAt: record.licenseExpiresAt,
    lastAccessedAt: record.lastAccessedAt,
    autoDeleteAt: record.lastAccessedAt,
    revokedAt: null,
    revokedReason: null,
    createdAt: record.createdAt,
    updatedAt: record.downloadedAt,
  };
}

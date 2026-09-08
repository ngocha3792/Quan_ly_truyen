import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import {
  formatOfflineBytes,
  isOfflinePackageExpired,
  OfflinePackageStatus,
  OfflinePackageSummary,
  PackageDownloadProgress,
} from '../../domain/offline-package.models';

@Component({
  selector: 'app-offline-package-list',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './offline-package-list.component.html',
  styleUrl: './offline-package-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfflinePackageListComponent {
  readonly packages = input.required<readonly OfflinePackageSummary[]>();
  readonly localPackageIds = input<readonly string[]>([]);
  readonly downloadProgress = input<Readonly<Record<string, PackageDownloadProgress>>>({});
  readonly busyPackageIds = input<readonly string[]>([]);
  readonly online = input(true);
  readonly serverActionsAvailable = input(true);

  readonly downloadRequested = output<string>();
  readonly openRequested = output<string>();
  readonly localDeleteRequested = output<string>();
  readonly serverDeleteRequested = output<OfflinePackageSummary>();

  protected readonly formatBytes = formatOfflineBytes;
  protected readonly isExpired = isOfflinePackageExpired;

  protected isLocal(packageId: string): boolean {
    return this.localPackageIds().includes(packageId);
  }

  protected isBusy(packageId: string): boolean {
    return (
      this.busyPackageIds().includes(packageId) || this.downloadProgress()[packageId] !== undefined
    );
  }

  protected canDownload(offlinePackage: OfflinePackageSummary): boolean {
    return (
      this.serverActionsAvailable() &&
      offlinePackage.status === 'READY' &&
      !this.isExpired(offlinePackage)
    );
  }

  protected downloadLabel(): string {
    if (!this.online()) return 'Chờ kết nối';
    return this.serverActionsAvailable() ? 'Tải về máy' : 'Cần đăng nhập';
  }

  protected statusLabel(status: OfflinePackageStatus): string {
    const labels: Record<OfflinePackageStatus, string> = {
      PREPARING: 'Đang chuẩn bị',
      READY: 'Sẵn sàng',
      EXPIRED: 'Hết hạn',
      REVOKED: 'Đã thu hồi',
    };
    return labels[status];
  }

  protected formatDate(value: string | null): string {
    if (!value) return 'Không giới hạn';
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return 'Không xác định';
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(timestamp);
  }
}

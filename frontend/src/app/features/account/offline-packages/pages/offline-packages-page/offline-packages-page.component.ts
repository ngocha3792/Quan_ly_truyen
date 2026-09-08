import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../../../../core/auth/auth.store';
import { OfflineConnectivityService } from '../../../../../core/offline/offline-connectivity.service';
import { ServiceWorkerRegistrationService } from '../../../../../core/pwa/service-worker-registration.service';
import { DialogShellComponent } from '../../../../../shared/components/dialog-shell/dialog-shell.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { OfflinePackageCreateStore } from '../../data-access/offline-package-create.store';
import { OfflinePackagesStore } from '../../data-access/offline-packages.store';
import { OfflinePackageSummary } from '../../domain/offline-package.models';
import { CreateOfflinePackageDialogComponent } from '../../ui/create-offline-package-dialog/create-offline-package-dialog.component';
import { OfflinePackageListComponent } from '../../ui/offline-package-list/offline-package-list.component';
import { OfflineQuotaPanelComponent } from '../../ui/offline-quota-panel/offline-quota-panel.component';

type DeleteConfirmation = {
  readonly mode: 'local' | 'server';
  readonly offlinePackage: OfflinePackageSummary;
};

@Component({
  selector: 'app-offline-packages-page',
  standalone: true,
  imports: [
    IconComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    DialogShellComponent,
    OfflineQuotaPanelComponent,
    OfflinePackageListComponent,
    CreateOfflinePackageDialogComponent,
    RouterLink,
  ],
  templateUrl: './offline-packages-page.component.html',
  styleUrls: ['./offline-packages-page.component.scss', './offline-packages-page.dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfflinePackagesPageComponent implements OnInit {
  protected readonly store = inject(OfflinePackagesStore);
  protected readonly createStore = inject(OfflinePackageCreateStore);
  protected readonly connectivity = inject(OfflineConnectivityService);
  private readonly serviceWorker = inject(ServiceWorkerRegistrationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(AuthStore);
  protected readonly standalone = this.route.snapshot.data['offlineStandalone'] === true;
  protected readonly serverActionsAvailable = computed(
    () => this.connectivity.online() && this.auth.isAuthenticated(),
  );
  private serverWasAvailable = false;

  protected readonly deleteConfirmation = signal<DeleteConfirmation | null>(null);

  private readonly serverAvailabilityEffect = effect(() => {
    const available = this.serverActionsAvailable();
    if (available === this.serverWasAvailable) return;
    this.serverWasAvailable = available;
    if (available) {
      this.store.loadServerData();
      this.createStore.loadSources();
    }
  });

  ngOnInit(): void {
    this.connectivity.initialize();
    this.store.loadLocalData();
  }

  protected async openPackage(packageId: string): Promise<void> {
    try {
      const entry = await this.store.getPackageEntryRoute(packageId);
      if (!entry) {
        this.store.reportError('Gói trên thiết bị chưa có chương có thể mở.');
        return;
      }
      if (this.serverActionsAvailable()) await this.store.touchServerPackage(packageId);
      await this.router.navigate([
        '/truyen',
        entry.storySlug,
        'chuong',
        String(entry.chapterNumber),
      ]);
    } catch (error: unknown) {
      this.store.reportError(
        error instanceof Error ? error.message : 'Không thể mở gói trên thiết bị.',
      );
    }
  }

  protected createPackage(): void {
    this.createStore.createPackage((created) => this.store.acceptCreated(created));
  }

  protected requestLocalDelete(packageId: string): void {
    const offlinePackage = this.store.packages().find((item) => item.id === packageId);
    if (offlinePackage) this.deleteConfirmation.set({ mode: 'local', offlinePackage });
  }

  protected requestServerDelete(offlinePackage: OfflinePackageSummary): void {
    this.deleteConfirmation.set({ mode: 'server', offlinePackage });
  }

  protected confirmDelete(): void {
    const confirmation = this.deleteConfirmation();
    if (!confirmation) return;
    this.deleteConfirmation.set(null);
    if (confirmation.mode === 'local') {
      void this.store.removeLocalPackage(confirmation.offlinePackage.id);
      return;
    }
    this.store.deleteServerPackage(confirmation.offlinePackage);
  }

  protected async installApp(): Promise<void> {
    const outcome = await this.connectivity.promptInstall();
    if (outcome === 'accepted') this.store.reportMessage('Đã gửi yêu cầu cài ứng dụng.');
  }

  protected async applyUpdate(): Promise<void> {
    const applied = await this.serviceWorker.activateUpdate();
    this.store.reportMessage(
      applied ? 'Bản cập nhật sẽ được dùng ở lần mở tiếp theo.' : 'Chưa có bản cập nhật chờ cài.',
    );
  }

  protected confirmationTitle(): string {
    return this.deleteConfirmation()?.mode === 'local'
      ? 'Xóa bản tải trên thiết bị?'
      : 'Xóa gói khỏi tài khoản?';
  }

  protected confirmationMessage(): string {
    const confirmation = this.deleteConfirmation();
    if (!confirmation) return '';
    return confirmation.mode === 'local'
      ? `Nội dung “${confirmation.offlinePackage.name}” sẽ bị xóa khỏi thiết bị này nhưng gói vẫn còn trên tài khoản.`
      : `Gói “${confirmation.offlinePackage.name}” và bản tải trên thiết bị này sẽ bị xóa.`;
  }
}

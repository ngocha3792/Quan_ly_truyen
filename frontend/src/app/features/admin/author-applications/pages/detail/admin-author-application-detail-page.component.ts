import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';

import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';

import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';

import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';

import { AdminAuthorApplicationsStore } from '../../data-access/admin-author-applications.store';

import { AdminAuthorApplicationApproveDialogComponent } from '../../ui/admin-author-application-approve-dialog.component';

import { AdminAuthorApplicationRejectDialogComponent } from '../../ui/admin-author-application-reject-dialog.component';

import { AdminAuthorApplicationStatusBadgeComponent } from '../../ui/admin-author-application-status-badge.component';

@Component({
  selector: 'app-admin-author-application-detail-page',

  standalone: true,

  imports: [
    RouterLink,

    BreadcrumbComponent,
    PageHeadingComponent,
    LoadingStateComponent,
    ErrorAlertComponent,

    AdminAuthorApplicationStatusBadgeComponent,
    AdminAuthorApplicationApproveDialogComponent,
    AdminAuthorApplicationRejectDialogComponent,
  ],

  providers: [AdminAuthorApplicationsStore],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './admin-author-application-detail-page.component.html',

  styleUrl: './admin-author-application-detail-page.component.scss',
})
export class AdminAuthorApplicationDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  private readonly destroyRef = inject(DestroyRef);

  protected readonly store = inject(AdminAuthorApplicationsStore);

  protected readonly applicationId = this.route.snapshot.paramMap.get('applicationId') ?? '';

  protected readonly approveDialogOpen = signal(false);

  protected readonly rejectDialogOpen = signal(false);

  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    {
      label: 'Trang chủ',

      route: '/',
    },

    {
      label: 'Hồ sơ tác giả',

      route: '/admin/author-applications',
    },

    {
      label: 'Chi tiết',
    },
  ];

  ngOnInit(): void {
    this.store.loadDetail(this.applicationId);
  }

  protected openApproveDialog(): void {
    this.store.clearActionFeedback();

    this.approveDialogOpen.set(true);
  }

  protected closeApproveDialog(): void {
    if (this.store.isReviewing()) {
      return;
    }

    this.approveDialogOpen.set(false);
  }

  protected openRejectDialog(): void {
    this.store.clearActionFeedback();

    this.rejectDialogOpen.set(true);
  }

  protected closeRejectDialog(): void {
    if (this.store.isReviewing()) {
      return;
    }

    this.rejectDialogOpen.set(false);
  }

  protected handleApprove(): void {
    this.store
      .approve()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.approveDialogOpen.set(false);
        },
      });
  }

  protected handleReject(reason: string): void {
    this.store
      .reject(reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.rejectDialogOpen.set(false);
        },
      });
  }

  protected displayText(value: string | null | undefined): string {
    const normalized = value?.trim();

    return normalized || '—';
  }

  protected formatDate(value: string | null): string {
    if (!value) {
      return '—';
    }

    return new Date(value).toLocaleString('vi-VN');
  }

  protected formatFileSize(value: string | null): string {
    if (!value) {
      return 'Không rõ kích thước';
    }

    const bytes = Number(value);

    if (!Number.isFinite(bytes) || bytes < 0) {
      return 'Không rõ kích thước';
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

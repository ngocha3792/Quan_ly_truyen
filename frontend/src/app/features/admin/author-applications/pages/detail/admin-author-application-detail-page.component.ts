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
import { AdminAuthorApplicationActionsStore } from '../../data-access/admin-author-application-actions.store';
import { AdminAuthorApplicationDetailStore } from '../../data-access/admin-author-application-detail.store';
import { AdminAuthorApplicationApproveDialogComponent } from '../../ui/admin-author-application-approve-dialog.component';
import { AdminAuthorApplicationRejectDialogComponent } from '../../ui/admin-author-application-reject-dialog.component';
import { AdminAuthorApplicationReviewHeaderComponent } from '../../ui/admin-author-application-review-header.component';
import { AdminAuthorApplicationSummaryComponent } from '../../ui/admin-author-application-summary.component';

@Component({
  selector: 'app-admin-author-application-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    BreadcrumbComponent,
    PageHeadingComponent,
    LoadingStateComponent,
    ErrorAlertComponent,
    AdminAuthorApplicationReviewHeaderComponent,
    AdminAuthorApplicationSummaryComponent,
    AdminAuthorApplicationApproveDialogComponent,
    AdminAuthorApplicationRejectDialogComponent,
  ],
  providers: [AdminAuthorApplicationDetailStore, AdminAuthorApplicationActionsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-author-application-detail-page.component.html',
  styleUrl: './admin-author-application-detail-page.component.scss',
})
export class AdminAuthorApplicationDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly detailStore = inject(AdminAuthorApplicationDetailStore);
  protected readonly actionsStore = inject(AdminAuthorApplicationActionsStore);
  protected readonly applicationId = this.route.snapshot.paramMap.get('applicationId') ?? '';
  protected readonly approveDialogOpen = signal(false);
  protected readonly rejectDialogOpen = signal(false);
  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Hồ sơ tác giả', route: '/admin/author-applications' },
    { label: 'Chi tiết' },
  ];
  ngOnInit(): void {
    this.actionsStore.clearFeedback();
    this.detailStore.load(this.applicationId);
  }
  protected openApproveDialog(): void {
    this.actionsStore.clearFeedback();
    this.approveDialogOpen.set(true);
  }
  protected closeApproveDialog(): void {
    if (!this.actionsStore.isReviewing()) this.approveDialogOpen.set(false);
  }
  protected openRejectDialog(): void {
    this.actionsStore.clearFeedback();
    this.rejectDialogOpen.set(true);
  }
  protected closeRejectDialog(): void {
    if (!this.actionsStore.isReviewing()) this.rejectDialogOpen.set(false);
  }
  protected handleApprove(): void {
    this.actionsStore
      .approve()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: () => this.approveDialogOpen.set(false) });
  }
  protected handleReject(reason: string): void {
    this.actionsStore
      .reject(reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: () => this.rejectDialogOpen.set(false) });
  }
}

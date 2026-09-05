import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, finalize, Subject } from 'rxjs';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import { AdminReportsApiService } from '../../data-access/admin-reports-api.service';
import type {
  AdminReportList,
  AdminReportReason,
  AdminReportStatus,
} from '../../domain/admin-report.models';
import { AdminReportStatusBadgeComponent } from '../../ui/admin-report-status-badge.component';

const REPORT_STATUS_LABELS: Record<AdminReportStatus, string> = {
  OPEN: 'Mới',
  IN_REVIEW: 'Đang xử lý',
  RESOLVED: 'Đã xử lý',
  REJECTED: 'Đã từ chối',
};

const REPORT_REASON_LABELS: Record<AdminReportReason, string> = {
  SPAM: 'Spam',
  HARASSMENT: 'Quấy rối',
  HATE_SPEECH: 'Phát ngôn thù ghét',
  SEXUAL_CONTENT: 'Nội dung khiêu dâm',
  VIOLENCE: 'Bạo lực',
  COPYRIGHT: 'Vi phạm bản quyền',
  MISINFORMATION: 'Thông tin sai lệch',
  OTHER: 'Khác',
};

@Component({
  selector: 'app-admin-reports-list-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    BreadcrumbComponent,
    PageHeadingComponent,
    PaginationComponent,
    AdminReportStatusBadgeComponent,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
  ],
  templateUrl: './admin-reports-list-page.component.html',
  styleUrl: './admin-reports-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminReportsListPageComponent implements OnInit {
  private readonly api = inject(AdminReportsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Quản trị' },
    { label: 'Báo cáo' },
  ];
  readonly result = signal<AdminReportList | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly searchChanged = new Subject<void>();
  readonly statuses: readonly AdminReportStatus[] = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'];
  readonly reasons: readonly AdminReportReason[] = [
    'SPAM',
    'HARASSMENT',
    'HATE_SPEECH',
    'SEXUAL_CONTENT',
    'VIOLENCE',
    'COPYRIGHT',
    'MISINFORMATION',
    'OTHER',
  ];
  status = '';
  reason = '';
  reporter = '';
  reportedUser = '';
  createdFrom = '';
  createdTo = '';
  page = 1;
  readonly pageSize = 20;
  ngOnInit(): void {
    this.searchChanged
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.go(1));
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      this.status = p.get('status') ?? '';
      this.reason = p.get('reason') ?? '';
      this.reporter = p.get('reporter') ?? '';
      this.reportedUser = p.get('reportedUser') ?? '';
      this.createdFrom = p.get('createdFrom') ?? '';
      this.createdTo = p.get('createdTo') ?? '';
      this.page = Math.max(1, Number(p.get('page') ?? 1) || 1);
      this.load();
    });
  }
  protected reasonLabel(reason: AdminReportReason): string {
    return REPORT_REASON_LABELS[reason];
  }
  protected statusLabel(status: AdminReportStatus): string {
    return REPORT_STATUS_LABELS[status];
  }
  go(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: this.status || null,
        reason: this.reason || null,
        reporter: this.reporter.trim() || null,
        reportedUser: this.reportedUser.trim() || null,
        createdFrom: this.createdFrom || null,
        createdTo: this.createdTo || null,
        page,
      },
    });
  }
  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .list({
        status: (this.status as AdminReportStatus) || undefined,
        reason: (this.reason as AdminReportReason) || undefined,
        reporter: this.reporter.trim() || undefined,
        reportedUser: this.reportedUser.trim() || undefined,
        createdFrom: this.createdFrom || undefined,
        createdTo: this.createdTo || undefined,
        page: this.page,
        pageSize: this.pageSize,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (r) => this.result.set(r),
        error: (e: unknown) => this.error.set(getApiErrorMessage(e)),
      });
  }
}

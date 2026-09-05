import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, Observable, switchMap } from 'rxjs';
import { AuthStore } from '../../../../../core/auth/auth.store';
import {
  AUTH_PERMISSIONS,
  type AuthPermission,
} from '../../../../../core/auth/authorization.models';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { AdminReportsApiService } from '../../data-access/admin-reports-api.service';
import type { AdminReportDetail, AdminReportReason } from '../../domain/admin-report.models';
import { AdminReportStatusBadgeComponent } from '../../ui/admin-report-status-badge.component';

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
  selector: 'app-admin-report-detail-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    BreadcrumbComponent,
    PageHeadingComponent,
    AdminReportStatusBadgeComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    ButtonComponent,
  ],
  templateUrl: './admin-report-detail-page.component.html',
  styleUrl: './admin-report-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminReportDetailPageComponent implements OnInit {
  private readonly api = inject(AdminReportsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthStore);
  private readonly reportId = this.route.snapshot.paramMap.get('reportId') ?? '';
  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Quản trị' },
    { label: 'Báo cáo', route: '/admin/reports' },
    { label: 'Chi tiết' },
  ];
  readonly detail = signal<AdminReportDetail | null>(null);
  readonly loading = signal(false);
  readonly mutating = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly canModerate = computed(
    () =>
      this.has(AUTH_PERMISSIONS.COMMENT_MODERATE) && this.has(AUTH_PERMISSIONS.MODERATION_EXECUTE),
  );
  readonly canWarn = computed(() => this.has(AUTH_PERMISSIONS.MODERATION_EXECUTE));
  readonly canBan = computed(
    () => this.has(AUTH_PERMISSIONS.MODERATION_EXECUTE) && this.has(AUTH_PERMISSIONS.USER_MANAGE),
  );
  reason = '';
  warningMessage = '';
  decisionNote = '';
  readonly evidenceText = computed(() => {
    const value = this.detail()?.evidence;
    return value ? JSON.stringify(value, null, 2) : 'Không có evidence.';
  });
  readonly evidenceBody = computed(() => {
    const value = this.detail()?.evidence;
    if (!value || typeof value !== 'object') return '';
    const comment = (value as { comment?: { body?: unknown } }).comment;
    return typeof comment?.body === 'string' ? comment.body : '';
  });
  readonly editedAfterReport = computed(() => {
    const d = this.detail();
    if (!d?.currentComment?.editedAt) return false;
    return Date.parse(d.currentComment.editedAt) > Date.parse(d.createdAt);
  });
  ngOnInit(): void {
    this.load();
  }
  protected reasonLabel(reason: AdminReportReason): string {
    return REPORT_REASON_LABELS[reason];
  }
  moderate(operation: 'hold' | 'hide' | 'restore' | 'remove'): void {
    const d = this.detail(),
      reason = this.reason.trim();
    if (!d?.currentComment || reason.length < 10) return;
    this.run(
      this.api.moderate(d.currentComment.id, operation, reason, d.id),
      `Đã ${operation} comment.`,
    );
  }
  warn(): void {
    const d = this.detail(),
      reason = this.reason.trim(),
      message = this.warningMessage.trim();
    if (!d?.currentComment || reason.length < 10 || message.length < 10) return;
    this.run(
      this.api.warn(d.currentComment.id, reason, message, d.id),
      'Đã gửi cảnh báo bắt buộc.',
    );
  }
  ban(): void {
    const d = this.detail(),
      reason = this.reason.trim();
    if (!d?.currentComment || reason.length < 10) return;
    if (
      !window.confirm(
        `Ban user ${d.reportedUser?.displayName ?? ''}? Active sessions sẽ bị revoke; nội dung cũ không tự xóa.`,
      )
    )
      return;
    this.run(
      this.api.ban(d.currentComment.id, reason, d.id),
      'Đã ban user và invalidate quyền truy cập.',
    );
  }
  closeReport(kind: 'resolve' | 'reject'): void {
    const note = this.decisionNote.trim();
    if (note.length < 10) return;
    this.run(
      kind === 'resolve'
        ? this.api.resolve(this.reportId, note)
        : this.api.reject(this.reportId, note),
      kind === 'resolve' ? 'Đã resolve report.' : 'Đã reject report.',
    );
  }
  private run(request: Observable<unknown>, message: string): void {
    if (this.mutating()) return;
    this.mutating.set(true);
    this.error.set('');
    request
      .pipe(
        switchMap(() => this.api.detail(this.reportId)),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.mutating.set(false)),
      )
      .subscribe({
        next: (detail) => {
          this.detail.set(detail);
          this.message.set(message);
        },
        error: (e: unknown) => this.error.set(getApiErrorMessage(e)),
      });
  }
  protected load(): void {
    if (!this.reportId) return;
    this.loading.set(true);
    this.api
      .detail(this.reportId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (d) => this.detail.set(d),
        error: (e: unknown) => this.error.set(getApiErrorMessage(e)),
      });
  }
  private has(permission: AuthPermission): boolean {
    return this.auth.user()?.permissions.some((p) => p.toLowerCase() === permission) ?? false;
  }
}

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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { IconComponent, IconName } from '../../../../../shared/components/icon/icon.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import {
  StatCardComponent,
  StatCardTone,
} from '../../../../../shared/components/stat-card/stat-card.component';
import { AdminAuditLogsApiService } from '../../data-access/admin-audit-logs-api.service';
import type {
  AdminAuditLogDetail,
  AdminAuditLogListItem,
} from '../../domain/admin-audit-log.models';
import { AuditDiffComponent } from '../../ui/audit-diff/audit-diff.component';
import { AuditJsonViewerComponent } from '../../ui/audit-json-viewer/audit-json-viewer.component';
import { AuditRelatedEventsComponent } from '../../ui/audit-related-events/audit-related-events.component';

interface AuditStat {
  readonly label: string;
  readonly value: string;
  readonly meta: string;
  readonly icon: IconName;
  readonly tone: StatCardTone;
}

const ENTITY_ROUTES: Readonly<Record<string, string>> = {
  user: '/admin/users',
  author: '/admin/authors',
  report: '/admin/reports',
  story_submission: '/admin/story-submissions',
};

@Component({
  selector: 'app-admin-audit-log-detail-page',
  standalone: true,
  imports: [
    AuditDiffComponent,
    AuditJsonViewerComponent,
    AuditRelatedEventsComponent,
    DatePipe,
    RouterLink,
    BreadcrumbComponent,
    ButtonComponent,
    IconComponent,
    PageHeadingComponent,
    StatCardComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
  ],
  templateUrl: './admin-audit-log-detail-page.component.html',
  styleUrl: './admin-audit-log-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuditLogDetailPageComponent implements OnInit {
  private readonly api = inject(AdminAuditLogsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Quản trị' },
    { label: 'Audit log', route: '/admin/audit-logs' },
    { label: 'Chi tiết' },
  ];

  protected readonly detail = signal<AdminAuditLogDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly related = signal<readonly AdminAuditLogListItem[]>([]);
  protected readonly relatedLoading = signal(false);
  protected readonly stats = computed<readonly AuditStat[]>(() => {
    const detail = this.detail();
    return [
      {
        label: 'Thời gian',
        value: detail ? new Date(detail.createdAt).toLocaleTimeString('vi-VN') : '—',
        meta: detail
          ? `${new Date(detail.createdAt).toLocaleDateString('vi-VN')} · giờ trình duyệt`
          : 'Chưa tải',
        icon: 'clock',
        tone: 'purple',
      },
      {
        label: 'Người thực hiện',
        value: detail?.actor?.displayName || 'Không xác định',
        meta: detail?.actor?.email || 'Tài khoản đã xóa hoặc hệ thống',
        icon: 'user',
        tone: 'blue',
      },
      {
        label: 'Đối tượng',
        value: detail?.entity.type || '—',
        meta: detail?.entity.id || 'Không gắn với bản ghi cụ thể',
        icon: 'grid',
        tone: 'orange',
      },
      {
        label: 'Trường thay đổi',
        value: `${detail?.changes.length ?? 0} trường`,
        meta: detail?.requestId ? `Request ${detail.requestId}` : 'Không có request ID',
        icon: 'shuffle',
        tone: 'pink',
      },
    ];
  });

  ngOnInit(): void {
    this.load();
  }

  protected entityLink(detail: AdminAuditLogDetail): string[] | null {
    const id = detail.entity.id;
    const base = ENTITY_ROUTES[detail.entity.type.toLowerCase()];
    return id && base ? [base, id] : null;
  }

  protected open(link: readonly string[]): void {
    void this.router.navigate([...link]);
  }

  protected back(): void {
    void this.router.navigate(['/admin/audit-logs']);
  }

  protected copy(value: string | null): void {
    if (value) void globalThis.navigator?.clipboard?.writeText(value);
  }

  protected exportJson(detail: AdminAuditLogDetail): void {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${detail.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected load(): void {
    if (!this.id) return;
    this.loading.set(true);
    this.error.set('');
    this.api
      .detail(this.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (detail) => {
          this.detail.set(detail);
          this.loadRelated(detail.requestId);
        },
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  /** Sự kiện cùng request lấy qua chính bộ lọc requestId của API danh sách. */
  private loadRelated(requestId: string | null): void {
    if (!requestId) {
      this.related.set([]);
      return;
    }
    this.relatedLoading.set(true);
    this.api
      .list({ requestId, page: 1, pageSize: 20 })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.relatedLoading.set(false)),
      )
      .subscribe({
        next: (result) =>
          this.related.set(
            [...result.items].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
          ),
        error: () => this.related.set([]),
      });
  }
}

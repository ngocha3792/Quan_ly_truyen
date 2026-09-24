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
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { IconComponent, IconName } from '../../../../../shared/components/icon/icon.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import {
  StatCardComponent,
  StatCardTone,
} from '../../../../../shared/components/stat-card/stat-card.component';
import { AdminAuditLogsApiService } from '../../data-access/admin-audit-logs-api.service';
import type { AdminAuditLogList } from '../../domain/admin-audit-log.models';
import {
  distinctActions,
  distinctActors,
  distinctEntityTypes,
  formatCount,
  toCsv,
} from '../../domain/audit-insights';
import { AuditEventTableComponent } from '../../ui/audit-event-table/audit-event-table.component';
import { AuditInsightsComponent } from '../../ui/audit-insights/audit-insights.component';

interface AuditStat {
  readonly label: string;
  readonly value: string;
  readonly meta: string;
  readonly icon: IconName;
  readonly tone: StatCardTone;
}

@Component({
  selector: 'app-admin-audit-logs-list-page',
  standalone: true,
  imports: [
    FormsModule,
    BreadcrumbComponent,
    ButtonComponent,
    IconComponent,
    PageHeadingComponent,
    PaginationComponent,
    StatCardComponent,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    AuditEventTableComponent,
    AuditInsightsComponent,
  ],
  templateUrl: './admin-audit-logs-list-page.component.html',
  styleUrl: './admin-audit-logs-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuditLogsListPageComponent implements OnInit {
  private readonly api = inject(AdminAuditLogsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Quản trị' },
    { label: 'Nhật ký audit' },
  ];

  protected readonly result = signal<AdminAuditLogList | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly pageSizes = [20, 50, 100] as const;
  protected readonly stats = computed<readonly AuditStat[]>(() => {
    const result = this.result();
    const items = result?.items ?? [];
    const shown = `Trong ${formatCount(items.length)} sự kiện đang xem`;
    return [
      {
        label: 'Sự kiện khớp bộ lọc',
        value: result ? formatCount(result.pagination.totalItems) : '—',
        meta: result
          ? `Trang ${result.pagination.page}/${result.pagination.totalPages || 1}`
          : 'Chưa tải',
        icon: 'history',
        tone: 'purple',
      },
      {
        label: 'Người thực hiện',
        value: formatCount(distinctActors(items)),
        meta: shown,
        icon: 'users',
        tone: 'blue',
      },
      {
        label: 'Loại hành động',
        value: formatCount(distinctActions(items)),
        meta: shown,
        icon: 'zap',
        tone: 'orange',
      },
      {
        label: 'Loại đối tượng',
        value: formatCount(distinctEntityTypes(items)),
        meta: shown,
        icon: 'grid',
        tone: 'pink',
      },
    ];
  });

  protected actorId = '';
  protected action = '';
  protected entityType = '';
  protected entityId = '';
  protected requestId = '';
  protected from = '';
  protected to = '';
  protected page = 1;
  protected pageSize = 20;

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.actorId = params.get('actorId') ?? '';
      this.action = params.get('action') ?? '';
      this.entityType = params.get('entityType') ?? '';
      this.entityId = params.get('entityId') ?? '';
      this.requestId = params.get('requestId') ?? '';
      this.from = this.toLocalInput(params.get('from'));
      this.to = this.toLocalInput(params.get('to'));
      this.page = Math.max(1, Number(params.get('page') ?? 1) || 1);
      const size = Number(params.get('pageSize') ?? 20) || 20;
      this.pageSize = this.pageSizes.includes(size as (typeof this.pageSizes)[number]) ? size : 20;
      this.load();
    });
  }

  protected applyFilters(): void {
    void this.navigate(1);
  }

  protected clearFilters(): void {
    this.actorId = '';
    this.action = '';
    this.entityType = '';
    this.entityId = '';
    this.requestId = '';
    this.from = '';
    this.to = '';
    void this.navigate(1);
  }

  protected go(page: number): void {
    if (page < 1) return;
    void this.navigate(page);
  }

  protected changePageSize(size: number): void {
    this.pageSize = Number(size) || 20;
    void this.navigate(1);
  }

  protected copy(value: string): void {
    void globalThis.navigator?.clipboard?.writeText(value);
  }

  /** Xuất đúng những sự kiện đang hiển thị; API audit không có endpoint export. */
  protected exportCsv(): void {
    const items = this.result()?.items ?? [];
    if (items.length === 0) return;
    const url = URL.createObjectURL(new Blob([toCsv(items)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-trang-${this.page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private async navigate(page: number): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        actorId: this.actorId.trim() || null,
        action: this.action.trim() || null,
        entityType: this.entityType.trim() || null,
        entityId: this.entityId.trim() || null,
        requestId: this.requestId.trim() || null,
        from: this.toIso(this.from),
        to: this.toIso(this.to),
        page: page > 1 ? page : null,
        pageSize: this.pageSize === 20 ? null : this.pageSize,
      },
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .list({
        actorId: this.actorId.trim() || undefined,
        action: this.action.trim() || undefined,
        entityType: this.entityType.trim() || undefined,
        entityId: this.entityId.trim() || undefined,
        requestId: this.requestId.trim() || undefined,
        from: this.toIso(this.from) ?? undefined,
        to: this.toIso(this.to) ?? undefined,
        page: this.page,
        pageSize: this.pageSize,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) => this.error.set(getApiErrorMessage(error)),
      });
  }

  private toIso(value: string): string | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  private toLocalInput(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }
}

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
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { LinkButtonComponent } from '../../../../../shared/components/link-button/link-button.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import { SearchFieldComponent } from '../../../../../shared/components/search-field/search-field.component';
import {
  TabFilterComponent,
  TabFilterOption,
} from '../../../../../shared/components/tab-filter/tab-filter.component';
import { AdminAuthorsApiService } from '../../data-access/admin-authors-api.service';
import type {
  AdminAuthorListResponse,
  AuthorLifecycleStatus,
} from '../../domain/admin-author.models';
import { AdminAuthorStatusBadgeComponent } from '../../ui/admin-author-status-badge.component';

const AUTHOR_STATUS_LABELS: Record<AuthorLifecycleStatus, string> = {
  ACTIVE: 'Hoạt động',
  SUSPENDED: 'Tạm khóa',
  REVOKED: 'Đã thu hồi',
};

@Component({
  selector: 'app-admin-authors-list-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    BreadcrumbComponent,
    PageHeadingComponent,
    PaginationComponent,
    AdminAuthorStatusBadgeComponent,
    EmptyStateComponent,
    ErrorAlertComponent,
    LinkButtonComponent,
    LoadingStateComponent,
    SearchFieldComponent,
    TabFilterComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-authors-list-page.component.html',
  styleUrl: './admin-authors-list-page.component.scss',
})
export class AdminAuthorsListPageComponent implements OnInit {
  private readonly api = inject(AdminAuthorsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Quản trị' },
    { label: 'Tác giả' },
  ];
  readonly searchChanged = new Subject<void>();
  readonly result = signal<AdminAuthorListResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  search = '';
  status: '' | AuthorLifecycleStatus = '';
  createdFrom = '';
  createdTo = '';
  page = 1;
  readonly pageSize = 20;
  protected readonly statusOptions: readonly TabFilterOption<'' | AuthorLifecycleStatus>[] = [
    { value: '', label: 'Tất cả' },
    { value: 'ACTIVE', label: AUTHOR_STATUS_LABELS.ACTIVE },
    { value: 'SUSPENDED', label: AUTHOR_STATUS_LABELS.SUSPENDED },
    { value: 'REVOKED', label: AUTHOR_STATUS_LABELS.REVOKED },
  ];
  ngOnInit(): void {
    this.searchChanged
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.apply());
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((q) => {
      this.search = q.get('search') ?? '';
      this.status = (q.get('status') as AuthorLifecycleStatus | null) ?? '';
      this.createdFrom = q.get('createdFrom') ?? '';
      this.createdTo = q.get('createdTo') ?? '';
      this.page = Math.max(1, Number(q.get('page') ?? 1) || 1);
      this.load();
    });
  }
  apply(): void {
    this.go(1);
  }
  protected keywordChanged(value: string): void {
    this.search = value;
    this.searchChanged.next();
  }
  protected statusChanged(value: '' | AuthorLifecycleStatus): void {
    this.status = value;
    this.apply();
  }
  go(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: this.search.trim() || null,
        status: this.status || null,
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
        search: this.search || undefined,
        status: this.status || undefined,
        createdFrom: this.createdFrom || undefined,
        createdTo: this.createdTo || undefined,
        page: this.page,
        pageSize: this.pageSize,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.result.set(r);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.error.set(getApiErrorMessage(e));
          this.loading.set(false);
        },
      });
  }
}

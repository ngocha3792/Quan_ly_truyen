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
import { AdminStoriesApiService } from '../../data-access/admin-stories-api.service';
import type {
  AdminStorySubmissionListResponse,
  AdminSubmissionStatus,
} from '../../domain/admin-story.models';
import { AdminStoryStatusBadgeComponent } from '../../ui/admin-story-status-badge.component';

const STORY_STATUS_LABELS: Record<AdminSubmissionStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  CANCELED: 'Đã hủy',
};

@Component({
  selector: 'app-admin-stories-list-page',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    AdminStoryStatusBadgeComponent,
    BreadcrumbComponent,
    LinkButtonComponent,
    PageHeadingComponent,
    PaginationComponent,
    SearchFieldComponent,
    TabFilterComponent,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-stories-list-page.component.html',
  styleUrl: './admin-stories-list-page.component.scss',
})
export class AdminStoriesListPageComponent implements OnInit {
  private readonly api = inject(AdminStoriesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Quản trị' },
    { label: 'Duyệt truyện' },
  ];
  readonly searchChanged = new Subject<void>();
  readonly loading = signal(false);
  readonly error = signal('');
  readonly result = signal<AdminStorySubmissionListResponse | null>(null);
  status: '' | AdminSubmissionStatus = '';
  author = '';
  story = '';
  reviewer = '';
  submittedFrom = '';
  submittedTo = '';
  page = 1;
  readonly pageSize = 20;
  protected readonly statusOptions: readonly TabFilterOption<'' | AdminSubmissionStatus>[] = [
    { value: '', label: 'Tất cả' },
    { value: 'PENDING', label: STORY_STATUS_LABELS.PENDING },
    { value: 'APPROVED', label: STORY_STATUS_LABELS.APPROVED },
    { value: 'REJECTED', label: STORY_STATUS_LABELS.REJECTED },
  ];
  ngOnInit(): void {
    this.searchChanged
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyFilters());
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((q) => {
      this.status = (q.get('status') as AdminSubmissionStatus | null) ?? '';
      this.author = q.get('author') ?? '';
      this.story = q.get('story') ?? '';
      this.reviewer = q.get('reviewer') ?? '';
      this.submittedFrom = q.get('submittedFrom') ?? '';
      this.submittedTo = q.get('submittedTo') ?? '';
      this.page = Math.max(1, Number(q.get('page') ?? 1) || 1);
      this.load();
    });
  }
  applyFilters(): void {
    this.navigate(1);
  }
  goPage(page: number): void {
    this.navigate(Math.max(1, page));
  }
  private navigate(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: this.status || null,
        author: this.author.trim() || null,
        story: this.story.trim() || null,
        reviewer: this.reviewer.trim() || null,
        submittedFrom: this.submittedFrom || null,
        submittedTo: this.submittedTo || null,
        page,
      },
    });
  }
  protected statusChanged(value: '' | AdminSubmissionStatus): void {
    this.status = value;
    this.applyFilters();
  }
  protected authorChanged(value: string): void {
    this.author = value;
    this.searchChanged.next();
  }
  protected storyChanged(value: string): void {
    this.story = value;
    this.searchChanged.next();
  }
  protected reviewerChanged(value: string): void {
    this.reviewer = value;
    this.searchChanged.next();
  }
  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .list({
        status: this.status || undefined,
        author: this.author || undefined,
        story: this.story || undefined,
        reviewer: this.reviewer || undefined,
        submittedFrom: this.submittedFrom || undefined,
        submittedTo: this.submittedTo || undefined,
        page: this.page,
        pageSize: this.pageSize,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.result.set(data);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.error.set(getApiErrorMessage(e));
          this.loading.set(false);
        },
      });
  }
}

import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthorFollowApiService, FollowingAuthorItem } from '@core/author-follow';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '@shared/components/breadcrumb/breadcrumb.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '@shared/components/error-alert/error-alert.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { LinkButtonComponent } from '@shared/components/link-button/link-button.component';
import { LoadingStateComponent } from '@shared/components/loading-state/loading-state.component';
import { PageHeadingComponent } from '@shared/components/page-heading/page-heading.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';

@Component({
  selector: 'app-following-page',
  standalone: true,
  imports: [
    RouterLink,
    BreadcrumbComponent,
    PageHeadingComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    PaginationComponent,
    IconComponent,
    LinkButtonComponent,
  ],
  templateUrl: './following-page.component.html',
  styleUrl: './following-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FollowingPageComponent {
  private readonly api = inject(AuthorFollowApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Tác giả đang theo dõi' },
  ];

  protected readonly items = signal<readonly FollowingAuthorItem[]>([]);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly loading = signal(false);
  protected readonly pending = signal<readonly string[]>([]);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.load(1);
  }

  protected load(page: number): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getFollowing(undefined, page, 20)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.items.set(result.items);
          this.page.set(result.pagination.page);
          this.totalPages.set(Math.max(1, result.pagination.totalPages));
        },
        error: () =>
          this.error.set('Không thể tải danh sách tác giả đang theo dõi. Vui lòng thử lại.'),
      });
  }

  protected unfollow(authorId: string): void {
    if (this.pending().includes(authorId)) return;
    this.error.set(null);
    this.pending.update((ids) => [...ids, authorId]);
    this.api
      .unfollow(authorId)
      .pipe(
        finalize(() => this.clearPending(authorId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () =>
          this.items.update((items) => items.filter((item) => item.author.id !== authorId)),
        error: () => this.error.set('Không thể bỏ theo dõi tác giả. Vui lòng thử lại.'),
      });
  }

  private clearPending(authorId: string): void {
    this.pending.update((ids) => ids.filter((id) => id !== authorId));
  }
}

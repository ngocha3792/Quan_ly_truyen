import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { BreadcrumbComponent } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { StatCardComponent } from '../../../../../shared/components/stat-card/stat-card.component';
import {
  TabFilterComponent,
  TabFilterOption,
} from '../../../../../shared/components/tab-filter/tab-filter.component';
import { AuthorAnalyticsHttpService } from '../../data-access/author-analytics-http.service';
import { AuthorAnalyticsOverview, StoryAnalyticsList } from '../../domain/author-analytics.models';

const RANGE_OPTIONS: readonly TabFilterOption<7 | 30 | 90>[] = [
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 90, label: '90 ngày' },
];

@Component({
  selector: 'app-author-analytics-page',
  standalone: true,
  imports: [
    RouterLink,
    BreadcrumbComponent,
    PageHeadingComponent,
    TabFilterComponent,
    StatCardComponent,
    LoadingStateComponent,
    ErrorAlertComponent,
    EmptyStateComponent,
  ],
  templateUrl: './author-analytics-page.component.html',
  styleUrl: './author-analytics-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorAnalyticsPageComponent {
  private readonly api = inject(AuthorAnalyticsHttpService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly breadcrumbs = [
    { label: 'Author Studio', route: '/author-studio/tong-quan' },
    { label: 'Thống kê' },
  ];
  protected readonly rangeOptions = RANGE_OPTIONS;
  readonly overview = signal<AuthorAnalyticsOverview | null>(null);
  readonly stories = signal<StoryAnalyticsList | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly days = signal<7 | 30 | 90>(30);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const raw = Number(params.get('days') ?? 30);
      const next = raw === 7 || raw === 90 ? raw : 30;
      this.days.set(next);
      this.load(next);
    });
  }

  protected setDays(days: 7 | 30 | 90): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { days },
      queryParamsHandling: 'merge',
    });
  }

  protected formatNumber(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  protected formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
  }

  protected formatRate(value: number | null): string {
    return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
  }

  protected barHeight(views: number): number {
    const series = this.overview()?.series ?? [];
    const max = Math.max(1, ...series.map((point) => point.views));
    return Math.max(4, Math.round((views / max) * 100));
  }

  protected load(days: number = this.days()): void {
    const { from, to } = dateRange(days);
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      overview: this.api.overview(from, to),
      stories: this.api.stories(from, to),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ overview, stories }) => {
          this.overview.set(overview);
          this.stories.set(stories);
        },
        error: () => {
          this.error.set('Không thể tải dữ liệu thống kê. Vui lòng thử lại.');
          this.loading.set(false);
        },
        complete: () => this.loading.set(false),
      });
  }
}

function dateRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: isoDate(from), to: isoDate(to) };
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

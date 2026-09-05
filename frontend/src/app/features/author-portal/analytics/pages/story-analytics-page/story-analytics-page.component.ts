import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';

import { BreadcrumbComponent } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { StatCardComponent } from '../../../../../shared/components/stat-card/stat-card.component';
import { AuthorAnalyticsHttpService } from '../../data-access/author-analytics-http.service';
import { StoryAnalyticsDetail } from '../../domain/author-analytics.models';

@Component({
  selector: 'app-story-analytics-page',
  standalone: true,
  imports: [
    RouterLink,
    BreadcrumbComponent,
    PageHeadingComponent,
    StatCardComponent,
    LoadingStateComponent,
    ErrorAlertComponent,
    EmptyStateComponent,
  ],
  templateUrl: './story-analytics-page.component.html',
  styleUrl: './story-analytics-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryAnalyticsPageComponent {
  private readonly api = inject(AuthorAnalyticsHttpService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly data = signal<StoryAnalyticsDetail | null>(null);
  protected readonly breadcrumbs = computed(() => [
    { label: 'Author Studio', route: '/author-studio/tong-quan' },
    { label: 'Thống kê', route: '/author-studio/thong-ke' },
    { label: this.data()?.story.title ?? 'Thống kê truyện' },
  ]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private lastStoryId = '';
  private lastFrom = '';
  private lastTo = '';

  constructor() {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, query]) => {
        const storyId = params.get('storyId');
        if (!storyId) return;
        const raw = Number(query.get('days') ?? 30);
        const days = raw === 7 || raw === 90 ? raw : 30;
        const { from, to } = dateRange(days);
        this.load(storyId, from, to);
      });
  }

  protected formatNumber(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
  }
  protected formatRate(value: number | null): string {
    return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
  }
  protected formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
  }
  protected barHeight(views: number): number {
    const series = this.data()?.series ?? [];
    const max = Math.max(1, ...series.map((point) => point.views));
    return Math.max(4, Math.round((views / max) * 100));
  }

  protected retry(): void {
    if (this.lastStoryId) this.load(this.lastStoryId, this.lastFrom, this.lastTo);
  }

  private load(storyId: string, from: string, to: string): void {
    this.lastStoryId = storyId;
    this.lastFrom = from;
    this.lastTo = to;
    this.loading.set(true);
    this.error.set(null);
    this.api
      .story(storyId, from, to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.data.set(data),
        error: () => {
          this.error.set('Không thể tải thống kê truyện này.');
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
  return { from: toIso(from), to: toIso(to) };
}
function toIso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthorAnalyticsHttpService } from '../../data-access/author-analytics-http.service';
import { AuthorAnalyticsOverview, StoryAnalyticsList } from '../../domain/author-analytics.models';

@Component({
  selector: 'app-author-analytics-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './author-analytics-page.component.html',
  styleUrl: './author-analytics-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorAnalyticsPageComponent {
  private readonly api = inject(AuthorAnalyticsHttpService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly overview = signal<AuthorAnalyticsOverview | null>(null);
  readonly stories = signal<StoryAnalyticsList | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly days = signal(30);

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

  private load(days: number): void {
    const { from, to } = dateRange(days);
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      overview: this.api.overview(from, to),
      stories: this.api.stories(from, to),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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

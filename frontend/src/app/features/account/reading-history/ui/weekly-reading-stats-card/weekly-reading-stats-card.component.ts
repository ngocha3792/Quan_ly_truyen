import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import type {
  WeeklyReadingDayStats,
  WeeklyReadingStats,
} from '../../domain/reading-history.models';

@Component({
  selector: 'app-weekly-reading-stats-card',
  standalone: true,
  templateUrl: './weekly-reading-stats-card.component.html',
  styleUrl: './weekly-reading-stats-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeeklyReadingStatsCardComponent {
  @Input({ required: true })
  stats!: WeeklyReadingStats;

  protected dayLabel(date: string): string {
    const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][day] ?? '';
  }

  protected barHeight(day: WeeklyReadingDayStats): number {
    const maximum = Math.max(1, ...this.stats.daily.map((entry) => entry.readingMinutes));
    if (!day.active) return 4;
    return Math.max(18, Math.round((day.readingMinutes / maximum) * 100));
  }

  protected streakMessage(): string {
    if (this.stats.currentStreakDays > 0) {
      return 'Giữ nhịp bằng một chương hôm nay.';
    }
    return 'Đọc hôm nay để bắt đầu chuỗi mới.';
  }
}

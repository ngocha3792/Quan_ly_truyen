import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { IconName } from '../../../../shared/components/icon/icon.component';
import {
  StatCardComponent,
  StatCardTone,
} from '../../../../shared/components/stat-card/stat-card.component';
import { AiUsageSummary } from '../domain/admin-ai-settings.models';
import { formatCount, formatPercent } from '../domain/ai-usage.metrics';

interface AiUsageStat {
  readonly label: string;
  readonly value: string;
  readonly meta: string;
  readonly icon: IconName;
  readonly tone: StatCardTone;
}

@Component({
  selector: 'app-ai-usage-stats',
  standalone: true,
  imports: [StatCardComponent],
  templateUrl: './ai-usage-stats.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiUsageStatsComponent {
  readonly usage = input<AiUsageSummary | null>(null);
  protected readonly stats = computed<readonly AiUsageStat[]>(() => {
    const usage = this.usage();
    const totals = usage?.totals;
    return [
      {
        label: 'Yêu cầu',
        value: totals ? formatCount(totals.requests) : '—',
        meta: totals
          ? `${formatCount(totals.successfulRequests)} thành công · ${formatCount(totals.failedRequests)} lỗi`
          : 'Chưa có dữ liệu',
        icon: 'activity',
        tone: 'purple',
      },
      {
        label: 'Input tokens',
        value: totals ? formatCount(totals.inputTokens) : '—',
        meta: totals ? `Tổng ${formatCount(totals.totalTokens)} token` : 'Chưa có dữ liệu',
        icon: 'arrow-down',
        tone: 'blue',
      },
      {
        label: 'Output tokens',
        value: totals ? formatCount(totals.outputTokens) : '—',
        meta: totals
          ? `${formatPercent((totals.outputTokens / (totals.totalTokens || 1)) * 100)} tổng token`
          : 'Chưa có dữ liệu',
        icon: 'arrow-up',
        tone: 'orange',
      },
      {
        label: 'Độ trễ trung bình',
        value: totals ? `${formatCount(totals.averageLatencyMs)} ms` : '—',
        meta: totals ? `Trên ${formatCount(totals.requests)} yêu cầu` : 'Chưa có dữ liệu',
        icon: 'zap',
        tone: 'indigo',
      },
      {
        label: 'Tỷ lệ lỗi',
        value: totals ? formatPercent(totals.errorRate) : '—',
        meta: totals ? `${formatCount(totals.failedRequests)} yêu cầu lỗi` : 'Chưa có dữ liệu',
        icon: 'alert-triangle',
        tone: 'pink',
      },
    ];
  });
}

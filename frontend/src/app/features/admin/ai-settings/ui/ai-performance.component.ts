import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { AiUsageSummary } from '../domain/admin-ai-settings.models';
import {
  donutGradient,
  formatCount,
  formatPercent,
  modelLatencyRows,
  successRate,
  tokenSegments,
  tokensPerRequest,
} from '../domain/ai-usage.metrics';
import { AiBarListComponent } from './ai-bar-list.component';

@Component({
  selector: 'app-ai-performance',
  standalone: true,
  imports: [AiBarListComponent, IconComponent],
  templateUrl: './ai-performance.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiPerformanceComponent {
  readonly usage = input<AiUsageSummary | null>(null);
  protected readonly segments = computed(() => {
    const usage = this.usage();
    return usage ? tokenSegments(usage) : [];
  });
  protected readonly gradient = computed(() => donutGradient(this.segments()));
  protected readonly totalTokens = computed(() => this.usage()?.totals.totalTokens ?? 0);
  protected readonly latencyRows = computed(() => {
    const usage = this.usage();
    return usage ? modelLatencyRows(usage) : [];
  });
  protected readonly tokensPerRequest = computed(() => {
    const usage = this.usage();
    return usage ? formatCount(tokensPerRequest(usage)) : '—';
  });
  protected readonly successRate = computed(() => {
    const usage = this.usage();
    return usage ? formatPercent(successRate(usage)) : '—';
  });
  protected readonly formatCount = formatCount;
}

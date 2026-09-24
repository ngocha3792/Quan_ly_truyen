import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { AI_PROTOCOL_LABELS, AiUsageSummary } from '../domain/admin-ai-settings.models';
import { formatCount, formatPercent, modelRequestRows } from '../domain/ai-usage.metrics';

@Component({
  selector: 'app-ai-model-usage',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './ai-model-usage.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiModelUsageComponent {
  readonly usage = input<AiUsageSummary | null>(null);
  protected readonly protocolLabels = AI_PROTOCOL_LABELS;
  protected readonly formatCount = formatCount;
  protected readonly formatPercent = formatPercent;
  protected readonly shares = computed(() => {
    const usage = this.usage();
    return new Map(usage ? modelRequestRows(usage).map((row) => [row.key, row]) : []);
  });
  protected readonly rows = computed(() => {
    const usage = this.usage();
    if (!usage) return [];
    return [...usage.byModel]
      .sort((a, b) => b.requests - a.requests)
      .map((item) => ({ ...item, key: `${item.protocol ?? 'none'}:${item.model}` }));
  });
}

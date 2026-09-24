import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import type { AdminAuditLogListItem } from '../../domain/admin-audit-log.models';
import {
  actionRows,
  donutGradient,
  entitySegments,
  formatCount,
} from '../../domain/audit-insights';

/**
 * Hai panel tổng hợp cho trang danh sách. Số liệu tính trên đúng trang sự kiện
 * đang hiển thị, vì API audit không có endpoint thống kê riêng.
 */
@Component({
  selector: 'app-audit-insights',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './audit-insights.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditInsightsComponent {
  readonly items = input.required<readonly AdminAuditLogListItem[]>();
  protected readonly formatCount = formatCount;
  protected readonly rows = computed(() => actionRows(this.items()));
  protected readonly segments = computed(() => entitySegments(this.items()));
  protected readonly gradient = computed(() => donutGradient(this.segments()));
}

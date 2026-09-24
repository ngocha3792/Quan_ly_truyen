import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { AdminAuditChange, SafeAuditValue } from '../../domain/admin-audit-log.models';

@Component({
  selector: 'app-audit-diff',
  standalone: true,
  templateUrl: './audit-diff.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditDiffComponent {
  readonly changes = input.required<readonly AdminAuditChange[]>();
  protected readonly typeLabels: Readonly<Record<AdminAuditChange['type'], string>> = {
    added: 'thêm mới',
    removed: 'xóa bỏ',
    changed: 'thay đổi',
  };
  protected format(value: SafeAuditValue | null): string {
    if (value === null || value === undefined) return '—';
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
}

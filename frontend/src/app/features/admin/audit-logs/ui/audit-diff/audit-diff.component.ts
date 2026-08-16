import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { AdminAuditChange, SafeAuditValue } from '../../domain/admin-audit-log.models';

@Component({
  selector: 'app-audit-diff',
  standalone: true,
  templateUrl: './audit-diff.component.html',
  styleUrl: './audit-diff.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditDiffComponent {
  @Input({ required: true }) changes: readonly AdminAuditChange[] = [];

  protected format(value: SafeAuditValue | null): string {
    if (value === null) return '—';
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
}

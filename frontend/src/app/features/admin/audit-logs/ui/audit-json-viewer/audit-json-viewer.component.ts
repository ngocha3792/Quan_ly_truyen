import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { SafeAuditValue } from '../../domain/admin-audit-log.models';

@Component({
  selector: 'app-audit-json-viewer',
  standalone: true,
  templateUrl: './audit-json-viewer.component.html',
  styleUrl: './audit-json-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditJsonViewerComponent {
  @Input({ required: true }) value!: SafeAuditValue;

  protected format(): string {
    return JSON.stringify(this.value, null, 2);
  }
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import type { SafeAuditValue } from '../../domain/admin-audit-log.models';

@Component({
  selector: 'app-audit-json-viewer',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './audit-json-viewer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditJsonViewerComponent {
  readonly value = input.required<SafeAuditValue>();
  readonly label = input('JSON');
  protected readonly text = computed(() => JSON.stringify(this.value(), null, 2) ?? 'null');
  protected readonly lines = computed(() => this.text().split('\n').length);
  protected readonly lineNumbers = computed(() =>
    Array.from({ length: this.lines() }, (_, index) => index + 1).join('\n'),
  );
  protected copy(): void {
    void globalThis.navigator?.clipboard?.writeText(this.text());
  }
}

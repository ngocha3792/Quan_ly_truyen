import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import type { AdminAuditLogListItem } from '../../domain/admin-audit-log.models';

/** Các sự kiện audit khác cùng một request ID, xếp theo thời gian. */
@Component({
  selector: 'app-audit-related-events',
  standalone: true,
  imports: [DatePipe, RouterLink, IconComponent],
  templateUrl: './audit-related-events.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditRelatedEventsComponent {
  readonly events = input.required<readonly AdminAuditLogListItem[]>();
  readonly currentId = input.required<string>();
  readonly requestId = input<string | null>(null);
  readonly loading = input(false);
}

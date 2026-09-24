import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { UserAvatarComponent } from '../../../../../shared/components/user-avatar/user-avatar.component';
import type { AdminAuditLogListItem } from '../../domain/admin-audit-log.models';

@Component({
  selector: 'app-audit-event-table',
  standalone: true,
  imports: [DatePipe, RouterLink, IconComponent, UserAvatarComponent],
  templateUrl: './audit-event-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditEventTableComponent {
  readonly items = input.required<readonly AdminAuditLogListItem[]>();
  readonly copyRequested = output<string>();
}

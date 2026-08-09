import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { AdminAuthorApplicationRecord } from '../domain/admin-author-application.models';

import { AdminAuthorApplicationStatusBadgeComponent } from './admin-author-application-status-badge.component';

@Component({
  selector: 'app-admin-author-application-table',

  standalone: true,

  imports: [RouterLink, AdminAuthorApplicationStatusBadgeComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './admin-author-application-table.component.html',

  styleUrl: './admin-author-application-table.component.scss',
})
export class AdminAuthorApplicationTableComponent {
  readonly applications = input.required<readonly AdminAuthorApplicationRecord[]>();

  protected formatDate(value: string | null): string {
    if (!value) {
      return 'Chưa gửi';
    }

    return new Date(value).toLocaleString('vi-VN');
  }
}

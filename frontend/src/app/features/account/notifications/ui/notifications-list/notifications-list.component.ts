import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { UserNotification } from '../../domain/notifications.models';

@Component({
  selector: 'app-notifications-list',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './notifications-list.component.html',

  styleUrl: './notifications-list.component.scss',
})
export class NotificationsListComponent {
  @Input({ required: true })
  notifications: readonly UserNotification[] = [];

  @Output()
  readonly readToggle = new EventEmitter<string>();

  @Output()
  readonly savedToggle = new EventEmitter<string>();
}

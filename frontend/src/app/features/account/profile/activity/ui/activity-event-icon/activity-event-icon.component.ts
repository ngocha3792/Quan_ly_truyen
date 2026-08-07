import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { IconComponent, IconName } from '../../../../../../shared/components/icon/icon.component';

import { ActivityTone, ActivityVisual } from '../../domain/account-activity.models';

@Component({
  selector: 'app-activity-event-icon',

  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <span class="event-icon" [attr.data-tone]="tone()">
      <app-icon [name]="iconName()" [size]="20" />
    </span>
  `,

  styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
    }

    .event-icon {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: #aeb6c6;
      background: rgba(100, 116, 139, 0.16);
      box-shadow: 0 9px 22px rgba(0, 0, 0, 0.14);
    }

    .event-icon[data-tone='green'] {
      color: #55dc78;
      background: rgba(34, 197, 94, 0.16);
    }

    .event-icon[data-tone='blue'] {
      color: #5aa7ff;
      background: rgba(37, 99, 235, 0.18);
    }

    .event-icon[data-tone='purple'] {
      color: #c180ff;
      background: rgba(126, 63, 211, 0.19);
    }

    .event-icon[data-tone='orange'] {
      color: #fb923c;
      background: rgba(234, 88, 12, 0.16);
    }

    .event-icon[data-tone='red'] {
      color: #fb7185;
      background: rgba(190, 24, 93, 0.16);
    }
  `,
})
export class ActivityEventIconComponent {
  readonly visual = input.required<ActivityVisual>();

  readonly tone = input<ActivityTone>('neutral');

  readonly iconName = computed<IconName>(() => {
    switch (this.visual()) {
      case 'login':
        return 'log-in';

      case 'logout':
        return 'logout';

      case 'password':
        return 'lock';

      case 'mfa':
        return 'shield';

      case 'email':
        return 'mail';

      case 'session':
        return 'monitor';

      case 'profile':
        return 'user';

      case 'device':
        return 'monitor';

      case 'warning':
        return 'alert-triangle';

      default:
        return 'history';
    }
  });
}

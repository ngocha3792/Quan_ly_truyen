import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from '@angular/core';

import { SessionBrowser } from '../../domain/account-session.models';

@Component({
    selector:
        'app-session-device-icon',

    standalone: true,

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <span
      class="device-icon"
      [attr.data-browser]="browser()"
      [attr.aria-label]="label()"
    >
      {{ abbreviation() }}
    </span>
  `,

    styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
    }

    .device-icon {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border: 5px solid
        rgba(255, 255, 255, .035);
      border-radius: 50%;
      color: #fff;
      font-size: 13px;
      font-weight: 850;
      line-height: 1;
      background:
        linear-gradient(
          145deg,
          #46516a,
          #252d40
        );
      box-shadow:
        0 8px 20px
        rgba(0, 0, 0, .2);
    }

    .device-icon[data-browser='chrome'] {
      background:
        conic-gradient(
          #ef4444 0 33%,
          #eab308 33% 66%,
          #22c55e 66% 100%
        );
    }

    .device-icon[data-browser='edge'] {
      background:
        linear-gradient(
          145deg,
          #0ea5e9,
          #16a34a
        );
    }

    .device-icon[data-browser='firefox'] {
      background:
        linear-gradient(
          145deg,
          #f97316,
          #7c3aed
        );
    }

    .device-icon[data-browser='safari'] {
      background:
        linear-gradient(
          145deg,
          #38bdf8,
          #2563eb
        );
    }

    .device-icon[data-browser='opera'] {
      background:
        linear-gradient(
          145deg,
          #f43f5e,
          #9f1239
        );
    }
  `,
})
export class SessionDeviceIconComponent {
    readonly browser =
        input<SessionBrowser>('browser');

    readonly label =
        input('Trình duyệt');

    readonly abbreviation =
        computed(() => {
            switch (this.browser()) {
                case 'chrome':
                    return 'C';

                case 'edge':
                    return 'E';

                case 'firefox':
                    return 'F';

                case 'safari':
                    return 'S';

                case 'opera':
                    return 'O';

                default:
                    return 'B';
            }
        });
}
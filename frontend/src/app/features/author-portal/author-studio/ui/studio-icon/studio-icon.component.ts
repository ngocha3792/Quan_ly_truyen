
import {
    ChangeDetectionStrategy,
    Component,
    Input,
} from '@angular/core';

import {
    StudioIconName,
} from '../../domain/author-studio.models';

@Component({
    selector: 'app-studio-icon',
    standalone: true,
    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      @switch (name) {
        @case ('home') {
          <path d="m3 11 9-8 9 8"></path>
          <path d="M5 10v10h5v-6h4v6h5V10"></path>
        }

        @case ('book') {
          <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H11a2 2 0 0 1 2 2v17a3 3 0 0 0-3-3H4V4.5Z"></path>
          <path d="M20 4.5A2.5 2.5 0 0 0 17.5 2H13v19a3 3 0 0 1 3-3h4V4.5Z"></path>
        }

        @case ('chapter') {
          <rect x="4" y="3" width="16" height="18" rx="2"></rect>
          <path d="M8 8h8"></path>
          <path d="M8 12h8"></path>
          <path d="M8 16h5"></path>
        }

        @case ('draft') {
          <path d="M5 3h10l4 4v14H5V3Z"></path>
          <path d="M14 3v5h5"></path>
          <path d="M8 13h8"></path>
          <path d="M8 17h5"></path>
        }

        @case ('calendar') {
          <rect x="3" y="5" width="18" height="16" rx="2"></rect>
          <path d="M7 3v4"></path>
          <path d="M17 3v4"></path>
          <path d="M3 10h18"></path>
        }

        @case ('comment') {
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"></path>
          <path d="M8 9h8"></path>
          <path d="M8 13h5"></path>
        }

        @case ('chart') {
          <path d="M4 20V10"></path>
          <path d="M10 20V4"></path>
          <path d="M16 20v-7"></path>
          <path d="M22 20V7"></path>
        }

        @case ('wallet') {
          <rect x="3" y="5" width="18" height="15" rx="2"></rect>
          <path d="M16 10h5v5h-5a2.5 2.5 0 0 1 0-5Z"></path>
          <path d="M7 5V3h10v2"></path>
        }

        @case ('user') {
          <circle cx="12" cy="8" r="3"></circle>
          <path d="M5 20c.5-4 2.8-6 7-6s6.5 2 7 6"></path>
        }

        @case ('profile') {
          <circle cx="12" cy="8" r="3"></circle>
          <path d="M5 20c.5-4 2.8-6 7-6s6.5 2 7 6"></path>
        }

        @case ('bell') {
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
          <path d="M10 21h4"></path>
        }

        @case ('settings') {
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"></path>
        }

        @case ('search') {
          <circle cx="11" cy="11" r="7"></circle>
          <path d="m16 16 5 5"></path>
        }

        @case ('plus') {
          <path d="M12 5v14"></path>
          <path d="M5 12h14"></path>
        }

        @case ('menu') {
          <path d="M4 7h16"></path>
          <path d="M4 12h16"></path>
          <path d="M4 17h16"></path>
        }

        @case ('close') {
          <path d="m6 6 12 12"></path>
          <path d="m18 6-12 12"></path>
        }

        @case ('eye') {
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path>
          <circle cx="12" cy="12" r="2.5"></circle>
        }

        @case ('users') {
          <circle cx="9" cy="8" r="3"></circle>
          <circle cx="17" cy="9" r="2"></circle>
          <path d="M2.5 20c.5-4 2.3-6 6.5-6s6 2 6.5 6"></path>
          <path d="M15 14c3.7 0 5.8 2 6.3 5"></path>
        }

        @case ('clock') {
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M12 7v5l3 2"></path>
        }

        @case ('edit') {
          <path d="m4 20 4.5-1L19 8.5 15.5 5 5 15.5 4 20Z"></path>
          <path d="m13.5 7 3.5 3.5"></path>
        }

        @case ('image') {
          <rect x="3" y="4" width="18" height="16" rx="2"></rect>
          <circle cx="9" cy="9" r="2"></circle>
          <path d="m3 17 5-5 4 4 3-3 6 6"></path>
        }

        @case ('arrow-up') {
          <path d="m6 15 6-6 6 6"></path>
        }

        @case ('arrow-down') {
          <path d="m6 9 6 6 6-6"></path>
        }

        @case ('chevron-down') {
          <path d="m8 10 4 4 4-4"></path>
        }

        @case ('more') {
          <circle cx="5" cy="12" r="1"></circle>
          <circle cx="12" cy="12" r="1"></circle>
          <circle cx="19" cy="12" r="1"></circle>
        }

        @case ('check') {
          <path d="m5 12 4 4L19 6"></path>
        }

        @case ('target') {
          <circle cx="12" cy="12" r="8"></circle>
          <circle cx="12" cy="12" r="4"></circle>
          <path d="m14.5 9.5 5-5"></path>
        }
      }
    </svg>
  `,

    styles: [`
    :host {
      display: inline-flex;
      line-height: 0;
    }

    svg {
      display: block;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `],
})
export class StudioIconComponent {
    @Input({ required: true })
    name!: StudioIconName;

    @Input()
    size = 20;
}
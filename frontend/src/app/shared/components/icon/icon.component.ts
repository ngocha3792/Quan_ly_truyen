import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'alert-triangle'
  | 'arrow-right'
  | 'bell'
  | 'book'
  | 'bookmark'
  | 'camera'
  | 'check'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'clock'
  | 'close'
  | 'copy'
  | 'edit'
  | 'eye'
  | 'eye-off'
  | 'fire'
  | 'grid'
  | 'history'
  | 'info'
  | 'key'
  | 'lock'
  | 'logout'
  | 'mail'
  | 'menu'
  | 'monitor'
  | 'plus'
  | 'play'
  | 'rotate-ccw'
  | 'save'
  | 'search'
  | 'shield'
  | 'sparkles'
  | 'star'
  | 'trash'
  | 'activity'
  | 'calendar'
  | 'log-in'
  | 'smartphone'
  | 'trophy'
  // giữ lại toàn bộ icon cũ
  | 'alert-triangle'
  | 'history'
  | 'monitor'
  | 'shield'
  | 'user'
  | 'mail'
  | 'lock'
  | 'logout'
  | 'search'
  | 'chevron-down';

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.stroke-width]="strokeWidth()"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('search') { <circle cx="11" cy="11" r="7"/><path d="m20 20-3.4-3.4"/> }
        @case ('bell') { <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/> }
        @case ('history') { <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/> }
        @case ('chevron-down') { <path d="m7 9 5 5 5-5"/> }
        @case ('chevron-left') { <path d="m15 18-6-6 6-6"/> }
        @case ('chevron-right') { <path d="m9 18 6-6-6-6"/> }
        @case ('menu') { <path d="M4 6h16M4 12h16M4 18h16"/> }
        @case ('close') { <path d="m6 6 12 12M18 6 6 18"/> }
        @case ('user') { <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/> }
        @case ('play') { <path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/> }
        @case ('plus') { <path d="M12 5v14M5 12h14"/> }
        @case ('bookmark') { <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4Z"/> }
        @case ('fire') { <path d="M12 22c4 0 7-3 7-7 0-3-1.5-5.5-4.5-8 .2 2-1.1 3.3-2.3 4.2C11.7 8.5 9.8 5.7 7 4c.3 4-2 6.2-2 10.5C5 18.7 8 22 12 22Z"/><path d="M9.5 17c0 2 1.1 3 2.5 3s2.5-1 2.5-3c0-1.3-.7-2.5-2.5-4-1.8 1.5-2.5 2.7-2.5 4Z"/> }
        @case ('sparkles') { <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2Z"/><path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8Z"/><path d="m19 13 .7 1.8 1.8.7-1.8.7L19 18l-.7-1.8-1.8-.7 1.8-.7Z"/> }
        @case ('trophy') { <path d="M8 4h8v4a4 4 0 0 1-8 0Z"/><path d="M12 12v5M8 21h8M9 17h6"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4"/> }
        @case ('grid') { <rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/> }
        @case ('clock') { <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/> }
        @case ('book') { <path d="M4 5a3 3 0 0 1 3-3h5v18H7a3 3 0 0 0-3 3Z"/><path d="M20 5a3 3 0 0 0-3-3h-5v18h5a3 3 0 0 1 3 3Z"/> }
        @case ('eye') { <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/> }
        @case ('star') { <path d="m12 2 3 6.1 6.7 1-4.8 4.7 1.1 6.7-6-3.2-6 3.2 1.1-6.7-4.8-4.7 6.7-1Z"/> }
        @case ('arrow-right') { <path d="M5 12h14M13 6l6 6-6 6"/> }
        @case ('logout') { <path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/> }
        @case ('check') { <path d="m5 12 4 4L19 6"/> }
        @case ('shield') { <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/> }
        @case ('mail') { <rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/> }
        @case ('lock') { <rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/> }
        @case ('copy') { <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/> }
        @case ('key') { <circle cx="8" cy="15" r="4"/><path d="m11 12 9-9"/><path d="m17 6 3 3"/><path d="m14 9 3 3"/> }
        @case ('alert-triangle') { <path d="M10.3 3.7 2.5 18a2 2 0 0 0 1.8 3h15.4a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/> }
        @case ('save') { <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/> }
        @case ('rotate-ccw') { <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/> }
        @case ('trash') { <path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 15H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/> }
        @case ('eye-off') { <path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 9 4 10 8a12.8 12.8 0 0 1-2.1 4.1"/><path d="M6.2 6.2A11.8 11.8 0 0 0 2 12c1 4 5 8 10 8a10 10 0 0 0 4.1-.9"/> }
        @case ('camera') { <path d="M14.5 4 16 6h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l1.5-2Z"/><circle cx="12" cy="13" r="3.5"/> }
        @case ('info') { <circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/> }
        @case ('monitor') { <rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/> }
        @case ('edit') { <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/> }
        @case ('activity') {
  <path
    d="M3 12h4l2-7 4 14 2-7h6"
  />
}

@case ('calendar') {
  <rect
    x="3"
    y="5"
    width="18"
    height="16"
    rx="2"
  />

  <path d="M16 3v4" />
  <path d="M8 3v4" />
  <path d="M3 10h18" />
}

@case ('log-in') {
  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
  <path d="m10 17 5-5-5-5" />
  <path d="M15 12H3" />
}

@case ('smartphone') {
  <rect
    x="5"
    y="2"
    width="14"
    height="20"
    rx="2"
  />

  <path d="M12 18h.01" />
}
      }
    </svg>
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly strokeWidth = input(1.8);
}

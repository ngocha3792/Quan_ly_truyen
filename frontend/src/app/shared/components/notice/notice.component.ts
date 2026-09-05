import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type NoticeKind = 'info' | 'success' | 'error';

@Component({
  selector: 'app-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notice.component.html',
  styleUrl: './notice.component.scss',
})
export class NoticeComponent {
  readonly kind = input<NoticeKind>('info');
  readonly message = input<string | null>(null);
}

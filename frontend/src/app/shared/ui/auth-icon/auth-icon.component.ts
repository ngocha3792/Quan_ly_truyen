import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';

export type AuthIconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'book'
  | 'check'
  | 'community'
  | 'eye'
  | 'eye-off'
  | 'gift'
  | 'lock'
  | 'mail'
  | 'moon'
  | 'shield'
  | 'spark'
  | 'user';

@Component({
  selector: 'app-auth-icon',
  standalone: true,
  templateUrl: './auth-icon.component.html',
  styleUrls: ['./auth-icon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthIconComponent {
  @Input({ required: true }) name: AuthIconName = 'book';
  @Input() strokeWidth = 1.8;
}

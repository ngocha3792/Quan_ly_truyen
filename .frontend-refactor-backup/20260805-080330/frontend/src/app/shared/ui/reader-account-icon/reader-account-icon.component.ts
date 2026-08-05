import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';

export type ReaderAccountIconName =
  | 'activity'
  | 'arrow-left'
  | 'arrow-right'
  | 'bell'
  | 'book'
  | 'bookmark'
  | 'calendar'
  | 'camera'
  | 'chart'
  | 'check'
  | 'chevron-down'
  | 'clock'
  | 'comment'
  | 'crown'
  | 'dashboard'
  | 'edit'
  | 'eye'
  | 'filter'
  | 'globe'
  | 'heart'
  | 'history'
  | 'library'
  | 'lock'
  | 'logout'
  | 'mail'
  | 'menu'
  | 'moon'
  | 'more'
  | 'palette'
  | 'phone'
  | 'search'
  | 'settings'
  | 'sort'
  | 'star'
  | 'user'
  | 'users'
  | 'x';

@Component({
  selector: 'app-reader-account-icon',
  standalone: true,
  templateUrl: './reader-account-icon.component.html',
  styleUrls: ['./reader-account-icon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReaderAccountIconComponent {
  @Input({ required: true }) name: ReaderAccountIconName = 'book';
  @Input() strokeWidth = 1.8;
}

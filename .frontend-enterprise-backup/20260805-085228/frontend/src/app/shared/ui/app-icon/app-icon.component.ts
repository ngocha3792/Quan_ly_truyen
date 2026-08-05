import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type AppIconName =
  | 'activity'
  | 'archive'
  | 'arrow-right'
  | 'arrow-up'
  | 'bell'
  | 'book'
  | 'book-open'
  | 'chevron-down'
  | 'database'
  | 'eye'
  | 'file-text'
  | 'grid'
  | 'hard-drive'
  | 'menu'
  | 'message'
  | 'more'
  | 'search'
  | 'server'
  | 'settings'
  | 'tag'
  | 'user'
  | 'users';

@Component({
  selector: 'app-icon',
  standalone: true,
  templateUrl: './app-icon.component.html',
  styleUrls: ['./app-icon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppIconComponent {
  @Input({ required: true }) name: AppIconName = 'grid';
  @Input() strokeWidth = 1.8;
}

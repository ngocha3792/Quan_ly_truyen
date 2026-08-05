import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type SiteIconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'bell'
  | 'book'
  | 'bookmark'
  | 'chevron-down'
  | 'clock'
  | 'community'
  | 'eye'
  | 'fire'
  | 'grid'
  | 'heart'
  | 'history'
  | 'menu'
  | 'moon'
  | 'ranking'
  | 'search'
  | 'sparkles'
  | 'star'
  | 'sun'
  | 'tag'
  | 'user'
  | 'x';

@Component({
  selector: 'app-site-icon',
  standalone: true,
  templateUrl: './site-icon.component.html',
  styleUrls: ['./site-icon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteIconComponent {
  @Input({ required: true }) name: SiteIconName = 'book';
  @Input() strokeWidth = 1.8;
}

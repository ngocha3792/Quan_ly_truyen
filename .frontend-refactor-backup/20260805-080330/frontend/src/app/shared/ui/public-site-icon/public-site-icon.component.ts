import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type PublicSiteIconName =
  | 'arrow-left' | 'arrow-right' | 'bell' | 'book' | 'bookmark'
  | 'clock' | 'comment' | 'eye' | 'filter' | 'heart' | 'home'
  | 'info' | 'library' | 'list' | 'menu' | 'moon' | 'search'
  | 'settings' | 'star' | 'user' | 'users' | 'x';

@Component({
  selector: 'app-public-site-icon',
  standalone: true,
  templateUrl: './public-site-icon.component.html',
  styleUrls: ['./public-site-icon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicSiteIconComponent {
  @Input({ required: true }) name: PublicSiteIconName = 'book';
}

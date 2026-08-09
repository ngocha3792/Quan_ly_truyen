import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { AuthorProfile } from '../../domain/author-detail.models';

@Component({
  selector: 'app-author-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './author-hero.component.html',

  styleUrl: './author-hero.component.scss',
})
export class AuthorHeroComponent {
  @Input({ required: true })
  profile!: AuthorProfile;

  @Input()
  following = false;

  @Input()
  followerLabel = '';

  @Output()
  readonly followToggle = new EventEmitter<void>();
}

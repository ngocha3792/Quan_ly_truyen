import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthorWork } from '../../domain/author-detail.models';

@Component({
  selector: 'app-author-works',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './author-works.component.html',

  styleUrl: './author-works.component.scss',
})
export class AuthorWorksComponent {
  @Input({ required: true })
  works: readonly AuthorWork[] = [];
}

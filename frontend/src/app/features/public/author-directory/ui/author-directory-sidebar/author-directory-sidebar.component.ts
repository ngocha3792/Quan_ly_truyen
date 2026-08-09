import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthorDirectoryStatistics, NewAuthorItem } from '../../domain/author-directory.models';

@Component({
  selector: 'app-author-directory-sidebar',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './author-directory-sidebar.component.html',

  styleUrl: './author-directory-sidebar.component.scss',
})
export class AuthorDirectorySidebarComponent {
  @Input({ required: true })
  statistics!: AuthorDirectoryStatistics;

  @Input({ required: true })
  newAuthors: readonly NewAuthorItem[] = [];
}

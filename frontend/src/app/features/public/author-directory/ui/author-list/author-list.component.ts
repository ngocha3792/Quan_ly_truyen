import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { AuthorDirectoryItem } from '../../domain/author-directory.models';

@Component({
  selector: 'app-author-list',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './author-list.component.html',

  styleUrl: './author-list.component.scss',
})
export class AuthorListComponent {
  @Input({ required: true })
  authors: readonly AuthorDirectoryItem[] = [];

  @Input()
  followedAuthorIds: readonly string[] = [];

  @Output()
  readonly followToggle = new EventEmitter<string>();
}

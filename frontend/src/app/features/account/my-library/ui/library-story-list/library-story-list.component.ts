import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';

import { LibraryStory, LibraryViewMode } from '../../domain/my-library.models';

@Component({
  selector: 'app-library-story-list',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './library-story-list.component.html',

  styleUrl: './library-story-list.component.scss',
})
export class LibraryStoryListComponent {
  @Input({ required: true })
  stories: readonly LibraryStory[] = [];

  @Input()
  viewMode: LibraryViewMode = 'grid';

  @Output()
  readonly favoriteToggle = new EventEmitter<string>();

  getStatusKey(story: LibraryStory): string {
    if (story.isCompleted) {
      return 'completed';
    }

    if (story.isFavorite) {
      return 'favorite';
    }

    if (story.isReading) {
      return 'reading';
    }

    return 'saved';
  }

  getStatusLabel(story: LibraryStory): string {
    if (story.isCompleted) {
      return 'FULL';
    }

    if (story.isFavorite) {
      return 'YÊU THÍCH';
    }

    if (story.isReading) {
      return 'ĐANG ĐỌC';
    }

    return 'TRONG THƯ VIỆN';
  }
}

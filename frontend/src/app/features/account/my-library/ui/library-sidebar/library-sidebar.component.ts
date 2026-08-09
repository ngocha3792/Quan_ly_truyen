import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  LibraryQuickItem,
  LibraryReadingGoal,
  LibraryStatistics,
} from '../../domain/my-library.models';

@Component({
  selector: 'app-library-sidebar',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './library-sidebar.component.html',

  styleUrl: './library-sidebar.component.scss',
})
export class LibrarySidebarComponent {
  @Input({ required: true })
  statistics!: LibraryStatistics;

  @Input({ required: true })
  quickItems: readonly LibraryQuickItem[] = [];

  @Input({ required: true })
  goal!: LibraryReadingGoal;

  getGoalProgress(): number {
    if (!this.goal?.targetChapters) {
      return 0;
    }

    return Math.min(
      100,
      Math.round((this.goal.completedChapters / this.goal.targetChapters) * 100),
    );
  }
}

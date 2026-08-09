import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { StoryUpdateItem } from '../../domain/story-updates.models';

import { UpdateStoryCardComponent } from '../update-story-card/update-story-card.component';

@Component({
  selector: 'app-update-story-grid',
  standalone: true,
  imports: [EmptyStateComponent, UpdateStoryCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './update-story-grid.component.html',
  styleUrl: './update-story-grid.component.scss',
})
export class UpdateStoryGridComponent {
  readonly stories = input.required<readonly StoryUpdateItem[]>();
  readonly loading = input(false);

  protected readonly skeletons = Array.from({ length: 6 }, (_, index) => index);
}

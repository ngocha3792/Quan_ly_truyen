import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { RelativeTimePipe } from '../../../../../shared/pipes/relative-time.pipe';

import { StoryUpdateItem } from '../../domain/story-updates.models';

@Component({
  selector: 'app-top-updates-card',
  standalone: true,
  imports: [RouterLink, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './top-updates-card.component.html',
  styleUrl: './top-updates-card.component.scss',
})
export class TopUpdatesCardComponent {
  readonly stories = input.required<readonly StoryUpdateItem[]>();
}

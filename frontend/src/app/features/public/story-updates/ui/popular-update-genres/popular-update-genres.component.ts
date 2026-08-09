import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { StoryUpdateGenreSummary } from '../../domain/story-updates.models';

@Component({
  selector: 'app-popular-update-genres',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './popular-update-genres.component.html',
  styleUrl: './popular-update-genres.component.scss',
})
export class PopularUpdateGenresComponent {
  readonly genres = input.required<readonly StoryUpdateGenreSummary[]>();
}

import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-genre-recommendation-card',

  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './genre-recommendation-card.component.html',

  styleUrl: './genre-recommendation-card.component.scss',
})
export class GenreRecommendationCardComponent {
  readonly requested = output<void>();
}

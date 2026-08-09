import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { IconComponent, IconName } from '../../../../../shared/components/icon/icon.component';

import { GenreTone, GenreVisual } from '../../domain/genre-discovery.models';

@Component({
  selector: 'app-genre-icon',

  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './genre-icon.component.html',

  styleUrl: './genre-icon.component.scss',
})
export class GenreIconComponent {
  readonly visual = input.required<GenreVisual>();

  readonly tone = input.required<GenreTone>();

  readonly compact = input(false);

  readonly iconName = computed<IconName>(() => {
    switch (this.visual()) {
      case 'action':
        return 'swords';

      case 'fantasy':
        return 'wand';

      case 'romance':
        return 'heart';

      case 'comedy':
        return 'smile';

      case 'manhwa':
      case 'manhua':
        return 'languages';

      case 'horror':
        return 'skull';

      case 'drama':
        return 'masks';

      case 'adventure':
        return 'compass';

      case 'school-life':
        return 'graduation-cap';

      case 'sci-fi':
        return 'rocket';

      case 'isekai':
        return 'door-open';
    }
  });
}

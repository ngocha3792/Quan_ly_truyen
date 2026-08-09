import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';

import { StoryRankingItem } from '../../domain/story-catalog.models';

@Component({
  selector: 'app-catalog-ranking',

  standalone: true,

  imports: [RouterLink, IconComponent, CompactNumberPipe],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './catalog-ranking.component.html',

  styleUrl: './catalog-ranking.component.scss',
})
export class CatalogRankingComponent {
  readonly stories = input.required<readonly StoryRankingItem[]>();
}

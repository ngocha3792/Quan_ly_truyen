import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';

import { GenreRankingItem } from '../../domain/genre-discovery.models';

@Component({
  selector: 'app-genre-ranking-card',

  standalone: true,

  imports: [RouterLink, IconComponent, CompactNumberPipe],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './genre-ranking-card.component.html',

  styleUrl: './genre-ranking-card.component.scss',
})
export class GenreRankingCardComponent {
  readonly items = input.required<readonly GenreRankingItem[]>();
}

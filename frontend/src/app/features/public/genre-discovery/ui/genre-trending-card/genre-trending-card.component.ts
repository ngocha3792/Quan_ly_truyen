import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { GenreTrendingItem } from '../../domain/genre-discovery.models';

@Component({
  selector: 'app-genre-trending-card',

  standalone: true,

  imports: [RouterLink, DecimalPipe],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './genre-trending-card.component.html',

  styleUrl: './genre-trending-card.component.scss',
})
export class GenreTrendingCardComponent {
  readonly items = input.required<readonly GenreTrendingItem[]>();
}

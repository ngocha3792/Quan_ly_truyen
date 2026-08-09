import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';

import { GenreSummary } from '../../domain/genre-discovery.models';

import { GenreIconComponent } from '../genre-icon/genre-icon.component';

@Component({
  selector: 'app-featured-genre-card',

  standalone: true,

  imports: [RouterLink, IconComponent, CompactNumberPipe, GenreIconComponent],

  templateUrl: './featured-genre-card.component.html',

  styleUrl: './featured-genre-card.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturedGenreCardComponent {
  readonly genre = input.required<GenreSummary>();
}

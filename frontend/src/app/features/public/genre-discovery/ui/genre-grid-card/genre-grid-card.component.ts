import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';

import { GenreSummary } from '../../domain/genre-discovery.models';

import { GenreIconComponent } from '../genre-icon/genre-icon.component';

@Component({
  selector: 'app-genre-grid-card',

  standalone: true,

  imports: [RouterLink, CompactNumberPipe, GenreIconComponent],

  templateUrl: './genre-grid-card.component.html',

  styleUrl: './genre-grid-card.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenreGridCardComponent {
  readonly genre = input.required<GenreSummary>();

  readonly rank = input<number | null>(null);
}

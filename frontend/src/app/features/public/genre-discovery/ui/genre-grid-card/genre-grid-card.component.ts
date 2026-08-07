import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';

import { GenreSummary } from '../../domain/genre-discovery.models';

import { GenreIconComponent } from '../genre-icon/genre-icon.component';

@Component({
    selector:
        'app-genre-grid-card',

    standalone: true,

    imports: [
        RouterLink,
        CompactNumberPipe,
        GenreIconComponent,
    ],

    template: `
    <a
      class="genre-card"
      [routerLink]="['/danh-sach']"
      [queryParams]="{
        genre: genre().slug,
        sort: 'popular'
      }"
    >
      <app-genre-icon
        [visual]="genre().visual"
        [tone]="genre().tone"
        [compact]="true"
      />

      <div class="genre-copy">
        <strong>{{ genre().name }}</strong>

        <p>{{ genre().description }}</p>

        <span>
          {{
            genre().storyCount
              | compactNumber
          }}
          truyện
        </span>
      </div>

      @if (rank()) {
        <span class="rank-badge">
          Top {{ rank() }}
        </span>
      }
    </a>
  `,

    styleUrl:
        './genre-grid-card.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class GenreGridCardComponent {
    readonly genre =
        input.required<GenreSummary>();

    readonly rank =
        input<number | null>(null);
}
import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import {
    RouterLink,
} from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';

import { GenreSummary } from '../../domain/genre-discovery.models';

import { GenreIconComponent } from '../genre-icon/genre-icon.component';

@Component({
    selector:
        'app-featured-genre-card',

    standalone: true,

    imports: [
        RouterLink,
        IconComponent,
        CompactNumberPipe,
        GenreIconComponent,
    ],

    template: `
    <a
      class="featured-card"
      [attr.data-tone]="genre().tone"
      [routerLink]="['/danh-sach']"
      [queryParams]="{
        genre: genre().slug,
        sort: 'popular'
      }"
    >
      @if (genre().coverUrl) {
        <img
          [src]="genre().coverUrl"
          [alt]="genre().name"
          loading="lazy"
        />
      }

      <div class="card-overlay"></div>

      <div class="card-content">
        <app-genre-icon
          [visual]="genre().visual"
          [tone]="genre().tone"
        />

        <h3>{{ genre().name }}</h3>

        <p>{{ genre().description }}</p>

        <span class="story-count">
          <app-icon
            name="book"
            [size]="13"
          />

          {{
            genre().storyCount
              | compactNumber
          }}
          truyện
        </span>
      </div>
    </a>
  `,

    styleUrl:
        './featured-genre-card.component.scss',

    changeDetection:
        ChangeDetectionStrategy.OnPush,
})
export class FeaturedGenreCardComponent {
    readonly genre =
        input.required<GenreSummary>();
}
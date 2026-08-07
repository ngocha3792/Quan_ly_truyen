import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { GenreSummary } from '../../domain/genre-discovery.models';

@Component({
  selector: 'app-genre-quick-filter',

  standalone: true,

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="filter-card">
      <span class="filter-label"> Bộ lọc nhanh </span>

      <div class="filter-list">
        <button
          type="button"
          [class.active]="selectedSlug() === null"
          (click)="selectedSlugChange.emit(null)"
        >
          Tất cả
        </button>

        @for (genre of genres(); track genre.id) {
          <button
            type="button"
            [class.active]="selectedSlug() === genre.slug"
            (click)="selectedSlugChange.emit(genre.slug)"
          >
            {{ genre.name }}
          </button>
        }
      </div>
    </section>
  `,

  styles: `
    .filter-card {
      /* Uses parent container padding and background */
    }

    .filter-label {
      margin-bottom: 7px;
      display: block;
      color: #828ca0;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .filter-list {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 7px;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .filter-list::-webkit-scrollbar {
      display: none;
    }

    button {
      min-height: 31px;
      padding: 0 13px;
      flex: 0 0 auto;
      border: 1px solid rgba(132, 145, 177, 0.15);
      border-radius: 7px;
      color: #969fb0;
      font-size: 0.85rem;
      font-weight: 620;
      cursor: pointer;
      background: rgba(12, 18, 33, 0.72);
      transition:
        color 160ms ease,
        border-color 160ms ease,
        background 160ms ease;
    }

    button:hover {
      color: #e8e5ed;
      border-color: rgba(155, 92, 238, 0.3);
    }

    button.active {
      border-color: transparent;
      color: #fff;
      background: linear-gradient(135deg, #743bde, #a153eb);
      box-shadow: 0 7px 18px rgba(114, 55, 216, 0.22);
    }
  `,
})
export class GenreQuickFilterComponent {
  readonly genres = input.required<readonly GenreSummary[]>();

  readonly selectedSlug = input<string | null>(null);

  readonly selectedSlugChange = output<string | null>();
}

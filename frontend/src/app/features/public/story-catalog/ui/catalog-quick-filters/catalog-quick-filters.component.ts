import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { StoryGenre, StoryPublicationStatus } from '../../domain/story-catalog.models';

@Component({
  selector: 'app-catalog-quick-filters',

  standalone: true,

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <div class="quick-filters">
      <div class="genre-list">
        <button
          type="button"
          [class.active]="selectedGenre() === null"
          (click)="genreChange.emit(null)"
        >
          Tất cả
        </button>

        @for (genre of genres(); track genre.id) {
          <button
            type="button"
            [class.active]="selectedGenre() === genre.slug"
            (click)="genreChange.emit(genre.slug)"
          >
            {{ genre.name }}
          </button>
        }
      </div>

      <div class="status-list">
        <button
          type="button"
          [class.active]="status() === 'ongoing'"
          (click)="statusChange.emit(status() === 'ongoing' ? 'all' : 'ongoing')"
        >
          Đang tiến hành
        </button>

        <button
          type="button"
          [class.active]="status() === 'completed'"
          (click)="statusChange.emit(status() === 'completed' ? 'all' : 'completed')"
        >
          Hoàn thành
        </button>
      </div>
    </div>
  `,

  styles: `
    .quick-filters {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
    }

    .genre-list,
    .status-list {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 7px;
    }

    button {
      min-height: 31px;
      padding: 0 13px;
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

    @media (max-width: 820px) {
      .quick-filters {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `,
})
export class CatalogQuickFiltersComponent {
  readonly genres = input.required<readonly StoryGenre[]>();

  readonly selectedGenre = input<string | null>(null);

  readonly status = input<StoryPublicationStatus | 'all'>('all');

  readonly genreChange = output<string | null>();

  readonly statusChange = output<StoryPublicationStatus | 'all'>();
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { GenreRankingItem, GenreSummary } from '../../domain/genre-discovery.models';

import { GenreGridCardComponent } from '../genre-grid-card/genre-grid-card.component';

@Component({
  selector: 'app-genre-grid',

  standalone: true,

  imports: [EmptyStateComponent, GenreGridCardComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="genre-section">
      <header>
        <h2>
          {{ selected() ? 'Thể loại đã chọn' : 'Tất cả thể loại' }}
        </h2>
      </header>

      @if (loading()) {
        <div class="genre-grid">
          @for (item of skeletons; track item) {
            <div class="skeleton-card">
              <span></span>

              <div>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          }
        </div>
      } @else if (genres().length === 0) {
        <app-empty-state
          class="genre-empty"
          icon="book"
          [iconSize]="31"
          title="Không tìm thấy thể loại"
        />
      } @else {
        <div class="genre-grid">
          @for (genre of genres(); track genre.id) {
            <app-genre-grid-card [genre]="genre" [rank]="findRank(genre.slug)" />
          }
        </div>
      }
    </section>
  `,

  styles: `
    .genre-section {
      /* Uses parent container padding and background */
    }

    header {
      margin-bottom: 10px;
    }

    h2 {
      margin: 0;
      color: #f0edf4;
      font-size: 0.9375rem;
    }

    .genre-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    .skeleton-card {
      min-height: 78px;
      padding: 12px;
      display: grid;
      grid-template-columns: 39px minmax(0, 1fr);
      gap: 11px;
      border-radius: 10px;
      background: #10182a;
    }

    .skeleton-card > span {
      width: 39px;
      height: 39px;
      border-radius: 10px;
      background: #1a243a;
    }

    .skeleton-card > div {
      display: grid;
      gap: 6px;
    }

    .skeleton-card > div span {
      height: 7px;
      border-radius: 20px;
      background: #1a243a;
    }

    .skeleton-card > div span:nth-child(2) {
      width: 85%;
    }

    .skeleton-card > div span:nth-child(3) {
      width: 45%;
    }

    .genre-empty {
      --empty-min-height: 220px;

      --empty-padding: 0;

      --empty-icon-color: #a76def;

      --empty-title-color: #dbd8e1;

      --empty-title-size: 0.875rem;
    }

    @media (max-width: 1050px) {
      .genre-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 720px) {
      .genre-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 470px) {
      .genre-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class GenreGridComponent {
  readonly genres = input.required<readonly GenreSummary[]>();

  readonly ranking = input.required<readonly GenreRankingItem[]>();

  readonly loading = input(false);

  readonly selected = input(false);

  protected readonly skeletons = Array.from({ length: 12 }, (_, index) => index);

  protected findRank(slug: string): number | null {
    return this.ranking().find((item) => item.slug === slug && item.rank <= 3)?.rank ?? null;
  }
}

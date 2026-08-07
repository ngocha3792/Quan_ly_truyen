import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { StoryCatalogItem, StoryCatalogViewMode } from '../../domain/story-catalog.models';

import { StoryCatalogCardComponent } from '../story-catalog-card/story-catalog-card.component';

@Component({
  selector: 'app-story-catalog-grid',

  standalone: true,

  imports: [EmptyStateComponent, StoryCatalogCardComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    @if (loading()) {
      <div class="story-grid" [class.list-mode]="viewMode() === 'list'">
        @for (item of skeletonItems; track item) {
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
    } @else if (stories().length === 0) {
      <app-empty-state
        class="catalog-empty"
        icon="book"
        [iconSize]="34"
        title="Không tìm thấy truyện"
        description="Hãy thử thay đổi từ khóa hoặc bộ lọc."
      />
    } @else {
      <div class="story-grid" [class.list-mode]="viewMode() === 'list'">
        @for (story of stories(); track story.id) {
          <app-story-catalog-card [story]="story" [viewMode]="viewMode()" />
        }
      </div>
    }
  `,

  styles: `
    .story-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 16px 12px;
    }

    .story-grid.list-mode {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .skeleton-card {
      display: grid;
      gap: 10px;
    }

    .skeleton-card > span {
      aspect-ratio: 0.72;
      border-radius: 10px;
      background: linear-gradient(90deg, #11192b, #1a2338, #11192b);
      background-size: 200% 100%;
      animation: skeleton-loading 1.3s infinite;
    }

    .skeleton-card > div {
      display: grid;
      gap: 6px;
    }

    .skeleton-card > div span {
      height: 9px;
      border-radius: 20px;
      background: #182136;
    }

    .skeleton-card > div span:nth-child(2) {
      width: 70%;
    }

    .skeleton-card > div span:nth-child(3) {
      width: 48%;
    }

    .catalog-empty {
      --empty-min-height: 390px;

      --empty-padding: 0;

      --empty-icon-color: #a86bf3;

      --empty-title-color: #e2dfe8;

      --empty-title-size: 1.15rem;

      --empty-description-color: #717b90;

      --empty-description-size: 0.85rem;
    }

    @keyframes skeleton-loading {
      to {
        background-position: -200% 0;
      }
    }

    @media (max-width: 1350px) {
      .story-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }
    }

    @media (max-width: 1120px) {
      .story-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }

    @media (max-width: 720px) {
      .story-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 500px) {
      .story-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class StoryCatalogGridComponent {
  readonly stories = input.required<readonly StoryCatalogItem[]>();

  readonly viewMode = input<StoryCatalogViewMode>('grid');

  readonly loading = input(false);

  protected readonly skeletonItems = Array.from({ length: 12 }, (_, index) => index);
}

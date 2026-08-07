import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { StoryUpdateItem } from '../../domain/story-updates.models';

import { UpdateStoryCardComponent } from '../update-story-card/update-story-card.component';

@Component({
  selector: 'app-update-story-grid',
  standalone: true,
  imports: [EmptyStateComponent, UpdateStoryCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="story-grid">
        @for (item of skeletons; track item) {
          <article class="skeleton">
            <span></span>
            <div>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </article>
        }
      </div>
    } @else if (stories().length === 0) {
      <app-empty-state
        class="updates-empty"
        icon="book-open"
        [iconSize]="32"
        title="Không có truyện phù hợp"
        description="Thử chọn bộ lọc hoặc cách sắp xếp khác."
      />
    } @else {
      <div class="story-grid">
        @for (story of stories(); track story.id) {
          <app-update-story-card [story]="story" />
        }
      </div>
    }
  `,
  styles: `
    .story-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .skeleton {
      min-height: 125px;
      padding: 12px;
      display: grid;
      grid-template-columns: 85px minmax(0, 1fr);
      gap: 14px;
      border-radius: 12px;
      background: #0f172a;
    }

    .skeleton > span {
      height: 115px;
      border-radius: 8px;
      background: #1e293b;
    }

    .skeleton > div {
      display: grid;
      align-content: start;
      gap: 10px;
    }

    .skeleton > div span {
      height: 14px;
      border-radius: 4px;
      background: #1e293b;
    }

    .skeleton > div span:nth-child(2) {
      width: 60%;
    }
    .skeleton > div span:nth-child(3) {
      width: 40%;
      margin-top: 18px;
    }

    .updates-empty {
      --empty-min-height: 240px;

      --empty-padding: 0;

      --empty-icon-color: #a66bef;

      --empty-title-color: #dcd9e2;

      --empty-title-size: 1rem;

      --empty-description-color: #717b8f;

      --empty-description-size: 0.875rem;
    }

    @media (max-width: 1100px) {
      .story-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 650px) {
      .story-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class UpdateStoryGridComponent {
  readonly stories = input.required<readonly StoryUpdateItem[]>();
  readonly loading = input(false);

  protected readonly skeletons = Array.from({ length: 6 }, (_, index) => index);
}

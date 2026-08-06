import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { IconComponent } from '../../../../shared/components/icon/icon.component';

import { StoryUpdateItem } from '../../domain/story-updates.models';

import { UpdateStoryCardComponent } from '../update-story-card/update-story-card.component';

@Component({
    selector: 'app-update-story-grid',
    standalone: true,
    imports: [
        IconComponent,
        UpdateStoryCardComponent,
    ],
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
      <section class="empty-state">
        <app-icon name="book-open" [size]="32" />
        <strong>Không có truyện phù hợp</strong>
        <p>Thử chọn bộ lọc hoặc cách sắp xếp khác.</p>
      </section>
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

    .skeleton > div span:nth-child(2) { width: 60%; }
    .skeleton > div span:nth-child(3) { width: 40%; margin-top: 18px; }

    .empty-state {
      min-height: 240px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 10px;
      color: #a66bef;
      text-align: center;
    }

    .empty-state strong {
      color: #dcd9e2;
      font-size: 1rem;
    }

    .empty-state p {
      margin: 0;
      color: #717b8f;
      font-size: .875rem;
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

    protected readonly skeletons = Array.from(
        { length: 6 },
        (_, index) => index,
    );
}
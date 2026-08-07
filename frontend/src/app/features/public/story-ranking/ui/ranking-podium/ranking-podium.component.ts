import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { StoryRankingItem } from '../../domain/story-ranking.models';

import { TopRankingCardComponent } from '../top-ranking-card/top-ranking-card.component';

@Component({
  selector: 'app-ranking-podium',

  standalone: true,

  imports: [TopRankingCardComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="podium">
      @if (stories()[1]; as second) {
        <app-top-ranking-card [story]="second" variant="second" />
      }

      @if (stories()[0]; as first) {
        <app-top-ranking-card [story]="first" variant="first" />
      }

      @if (stories()[2]; as third) {
        <app-top-ranking-card [story]="third" variant="third" />
      }
    </section>
  `,

  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .podium {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1.5rem;
      align-items: stretch;
    }

    @media (max-width: 1050px) {
      .podium {
        grid-template-columns: 1fr;
      }

      app-top-ranking-card:nth-child(2) {
        grid-row: 1;
      }
    }
  `,
})
export class RankingPodiumComponent {
  readonly stories = input.required<readonly StoryRankingItem[]>();
}

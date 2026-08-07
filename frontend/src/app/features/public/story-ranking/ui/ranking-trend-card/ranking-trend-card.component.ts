import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';

import { StoryRankingTrend } from '../../domain/story-ranking.models';

@Component({
  selector: 'app-ranking-trend-card',

  standalone: true,

  imports: [RouterLink, CompactNumberPipe],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="trend-card">
      <h2>Xu hướng tuần này</h2>

      <div class="trend-list">
        @for (item of trends(); track item.id) {
          <a class="trend-row" [routerLink]="['/truyen', item.slug]">
            <strong>
              {{ item.title }}
            </strong>

            <span class="progress">
              <span [style.width.%]="getWidth(item)"></span>
            </span>

            <small>
              {{ item.value | compactNumber }}
            </small>
          </a>
        }
      </div>
    </section>
  `,

  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .trend-card {
      padding: 1.25rem;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: linear-gradient(145deg, rgba(16, 24, 42, 0.96), rgba(9, 15, 29, 0.96));
    }

    h2 {
      margin: 0 0 1rem;
      color: #ece9f0;
      font-size: 1.15rem;
    }

    .trend-list {
      display: grid;
      gap: 0.875rem;
    }

    .trend-row {
      display: grid;
      grid-template-columns: 130px minmax(0, 1fr) 56px;
      align-items: center;
      gap: 0.75rem;
      color: inherit;
      text-decoration: none;
    }

    strong {
      overflow: hidden;
      color: #c9c6d0;
      font-size: 1rem;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      color: #9ba3b4;
      font-size: 0.85rem;
      text-align: right;
    }

    .progress {
      height: 4px;
      overflow: hidden;
      border-radius: 20px;
      background: #242d42;
    }

    .progress > span {
      height: 100%;
      min-width: 3px;
      display: block;
      border-radius: inherit;
      background: linear-gradient(90deg, #7c3cde, #a356eb);
    }
  `,
})
export class RankingTrendCardComponent {
  readonly trends = input.required<readonly StoryRankingTrend[]>();

  protected getWidth(item: StoryRankingTrend): number {
    if (item.maximumValue <= 0) {
      return 0;
    }

    return Math.max(4, Math.min(100, (item.value / item.maximumValue) * 100));
  }
}

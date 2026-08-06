import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import {
    IconComponent,
    IconName,
} from '../../../../shared/components/icon/icon.component';

import { CompactNumberPipe } from '../../../../shared/pipes/compact-number.pipe';

import { StoryRankingSummary } from '../../domain/story-ranking.models';

interface SummaryRow {
    readonly label: string;
    readonly value: number;

    readonly icon: IconName;
    readonly tone:
    | 'purple'
    | 'orange'
    | 'blue';

    readonly change: number;
    readonly suffix: string;
}

@Component({
    selector:
        'app-ranking-summary-card',

    standalone: true,

    imports: [
        IconComponent,
        CompactNumberPipe,
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <section class="summary-card">
      @for (
        row of rows();
        track row.label
      ) {
        <article class="summary-row">
          <span
            class="summary-icon"
            [attr.data-tone]="
              row.tone
            "
          >
            <app-icon
              [name]="row.icon"
              [size]="18"
            />
          </span>

          <span class="label">
            {{ row.label }}
          </span>

          <strong>
            {{
              row.value
                | compactNumber
            }}
          </strong>

          <small
            [class.negative]="
              row.change < 0
            "
          >
            {{
              row.change >= 0
                ? '↑'
                : '↓'
            }}

            {{
              row.change < 0
                ? -row.change
                : row.change
            }}{{ row.suffix }}
          </small>
        </article>
      }
    </section>
  `,

    styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .summary-card {
      padding: 1.25rem;
      display: grid;
      gap: .5rem;
      border: 1px solid var(--border);
      border-radius: 12px;
      background:
        linear-gradient(
          145deg,
          rgba(16, 24, 42, .96),
          rgba(9, 15, 29, .96)
        );
    }

    .summary-row {
      min-height: 48px;
      display: grid;
      grid-template-columns:
        34px minmax(0, 1fr) auto auto;
      align-items: center;
      gap: .75rem;
    }

    .summary-icon {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: 7px;
      color: #bb7df8;
      background:
        rgba(121, 58, 195, .18);
    }

    .summary-icon[data-tone='orange'] {
      color: #fb923c;
      background:
        rgba(234, 88, 12, .15);
    }

    .summary-icon[data-tone='blue'] {
      color: #62adff;
      background:
        rgba(37, 99, 235, .16);
    }

    .label {
      color: #9aa3b4;
      font-size: .85rem;
    }

    strong {
      color: #e8e5ec;
      font-size: 1.05rem;
    }

    small {
      color: #4fd778;
      font-size: .8rem;
      white-space: nowrap;
    }

    small.negative {
      color: #fb7185;
    }
  `,
})
export class RankingSummaryCardComponent {
    readonly summary =
        input.required<StoryRankingSummary>();

    protected rows():
        readonly SummaryRow[] {
        const summary =
            this.summary();

        return [
            {
                label: 'Tổng lượt đọc',

                value:
                    summary.totalReads,

                icon: 'book',
                tone: 'purple',

                change:
                    summary
                        .totalReadsChangePercent,

                suffix: '%',
            },
            {
                label: 'Truyện đang hot',

                value:
                    summary.hotStoryCount,

                icon: 'fire',
                tone: 'orange',

                change:
                    summary.hotStoryChange,

                suffix: '',
            },
            {
                label:
                    'Tổng người theo dõi',

                value:
                    summary.followerCount,

                icon: 'users',
                tone: 'blue',

                change:
                    summary
                        .followerChangePercent,

                suffix: '%',
            },
        ];
    }
}
import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { WeeklySummaryItem } from '../../domain/account-activity.models';

@Component({
    selector:
        'app-weekly-summary-card',

    standalone: true,

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <aside class="summary-card">
      <h2>Tóm tắt thời gian này</h2>

      <div class="summary-list">
        @for (
          item of items();
          track item.id
        ) {
          <div class="summary-item">
            <span>{{ item.label }}</span>

            <div class="summary-progress">
              <span
                [attr.data-tone]="
                  item.tone
                "
                [style.width.%]="
                  item.percent
                "
              ></span>
            </div>

            <strong>{{ item.count }}</strong>
          </div>
        }
      </div>
    </aside>
  `,

    styles: `
    .summary-card {
      padding: 18px;
      border: 1px solid var(--border);
      border-radius: 13px;
      background:
        linear-gradient(
          145deg,
          rgba(17, 25, 44, .98),
          rgba(10, 16, 31, .98)
        );
    }

    h2 {
      margin: 0 0 19px;
      color: #ebe9ef;
      font-size: 12px;
    }

    .summary-list {
      display: grid;
      gap: 15px;
    }

    .summary-item {
      display: grid;
      grid-template-columns:
        95px minmax(0, 1fr) 24px;
      align-items: center;
      gap: 10px;
    }

    .summary-item > span {
      color: #8a94a7;
      font-size: 8px;
    }

    .summary-item strong {
      color: #dcd9e2;
      font-size: 9px;
      text-align: right;
    }

    .summary-progress {
      height: 6px;
      overflow: hidden;
      border-radius: 20px;
      background: #252d40;
    }

    .summary-progress > span {
      height: 100%;
      min-width: 4px;
      display: block;
      border-radius: inherit;
      background: #9351ec;
    }

    .summary-progress
    > span[data-tone='green'] {
      background: #2dd4bf;
    }

    .summary-progress
    > span[data-tone='orange'] {
      background: #fb923c;
    }

    .summary-progress
    > span[data-tone='blue'] {
      background: #5b8ff9;
    }
  `,
})
export class WeeklySummaryCardComponent {
    readonly items =
        input.required<
            readonly WeeklySummaryItem[]
        >();
}
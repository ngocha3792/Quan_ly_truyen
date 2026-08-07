import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from '@angular/core';

import {
    IconComponent,
    IconName,
} from '../../../../../shared/components/icon/icon.component';

import { CompactNumberPipe } from '../../../../../shared/pipes/compact-number.pipe';

import { StoryUpdateStat } from '../../domain/story-updates.models';

@Component({
    selector: 'app-update-stat-card',
    standalone: true,
    imports: [
        IconComponent,
        CompactNumberPipe,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <article
      class="stat-card"
      [attr.data-tone]="stat().tone"
    >
      <span class="stat-icon">
        <app-icon
          [name]="iconName()"
          [size]="20"
        />
      </span>

      <div>
        <span class="label">
          {{ stat().label }}
        </span>

        <strong>
          {{ stat().value | compactNumber }}

          @if (stat().valueSuffix) {
            <small>{{ stat().valueSuffix }}</small>
          }
        </strong>

        <span
          class="comparison"
          [class.neutral]="stat().id === 'average-speed'"
        >
          {{ stat().comparisonText }}
        </span>
      </div>
    </article>
  `,
    styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .stat-card {
      min-height: 72px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      border: 1px solid var(--border, rgba(132, 145, 177, .16));
      border-radius: 12px;
      background: linear-gradient(
        145deg,
        rgba(16, 24, 42, .96),
        rgba(9, 15, 29, .96)
      );
    }

    .stat-icon {
      width: 42px;
      height: 42px;
      flex: 0 0 42px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: #bc7df9;
      background: rgba(121, 58, 195, .19);
    }

    .stat-card[data-tone='blue'] .stat-icon {
      color: #62adff;
      background: rgba(37, 99, 235, .17);
    }

    .stat-card[data-tone='pink'] .stat-icon {
      color: #ff6da7;
      background: rgba(219, 39, 119, .18);
    }

    .stat-card[data-tone='orange'] .stat-icon {
      color: #fb923c;
      background: rgba(234, 88, 12, .17);
    }

    .stat-card > div {
      min-width: 0;
      display: grid;
      gap: 2px;
    }

    .label {
      overflow: hidden;
      color: #8b96aa;
      font-size: .8rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      color: #f0edf4;
      font-size: 1.25rem;
      font-weight: 700;
      line-height: 1.2;
    }

    strong small {
      color: #a0aab8;
      font-size: .8rem;
      font-weight: 400;
      margin-left: 4px;
    }

    .comparison {
      color: #3ddc77;
      font-size: .75rem;
    }

    .comparison.neutral {
      color: #828ca0;
    }
  `,
})
export class UpdateStatCardComponent {
    readonly stat = input.required<StoryUpdateStat>();

    protected readonly iconName = computed<IconName>(() => {
        switch (this.stat().id) {
            case 'updated-stories':
                return 'book-open';
            case 'chapters-today':
                return 'calendar';
            case 'following':
                return 'heart';
            case 'average-speed':
                return 'zap';
        }
    });
}
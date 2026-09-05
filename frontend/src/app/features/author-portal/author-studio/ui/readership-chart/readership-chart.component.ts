import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';

import { DecimalPipe } from '@angular/common';

import {
  TabFilterComponent,
  TabFilterOption,
} from '../../../../../shared/components/tab-filter/tab-filter.component';
import { AuthorStudioPeriod, ReadershipChartPoint } from '../../domain/author-studio.models';

const PERIOD_OPTIONS: readonly TabFilterOption<AuthorStudioPeriod>[] = [
  { value: '7d', label: '7 ngày qua' },
  { value: '30d', label: '30 ngày qua' },
  { value: '90d', label: '90 ngày qua' },
];

@Component({
  selector: 'app-readership-chart',
  standalone: true,

  imports: [DecimalPipe, TabFilterComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="dashboard-card chart-card">
      <header>
        <div>
          <h2>
            Hiệu suất lượt đọc

            <span title="Lượt xem trong khoảng thời gian đã chọn"> i </span>
          </h2>

          <p>
            Lượt xem trong
            {{ selectedPeriodLabel }}
          </p>
        </div>

        <app-tab-filter
          [options]="periodOptions"
          [selected]="period"
          (selectedChange)="periodChange.emit($event)"
        />
      </header>

      <div class="chart-wrap">
        <svg
          class="chart"
          viewBox="0 0 760 225"
          preserveAspectRatio="none"
          role="img"
          aria-label="Biểu đồ lượt đọc"
        >
          <defs>
            <linearGradient id="chart-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#a855f7" stop-opacity=".48"></stop>

              <stop offset="100%" stop-color="#a855f7" stop-opacity="0"></stop>
            </linearGradient>

            <filter id="chart-glow">
              <feGaussianBlur stdDeviation="3" result="blur"></feGaussianBlur>

              <feMerge>
                <feMergeNode in="blur"></feMergeNode>

                <feMergeNode in="SourceGraphic"></feMergeNode>
              </feMerge>
            </filter>
          </defs>

          @for (grid of gridLines; track grid.value) {
            <line x1="42" x2="744" [attr.y1]="grid.y" [attr.y2]="grid.y" class="grid-line"></line>

            <text x="3" [attr.y]="grid.y + 4" class="grid-label">
              {{ grid.label }}
            </text>
          }

          <polygon [attr.points]="areaPoints()" fill="url(#chart-area-gradient)"></polygon>

          <polyline
            [attr.points]="linePoints()"
            fill="none"
            stroke="#b45dff"
            stroke-width="3"
            stroke-linejoin="round"
            stroke-linecap="round"
            filter="url(#chart-glow)"
          ></polyline>

          @for (point of positionedPoints(); track point.id) {
            <circle [attr.cx]="point.x" [attr.cy]="point.y" r="2.6" fill="#c379ff"></circle>
          }
        </svg>

        @if (peakPoint(); as peak) {
          <div
            class="chart-tooltip"
            [style.left.%]="peak.leftPercent"
            [style.top.px]="peak.tooltipTop"
          >
            <small>{{ peak.label }}</small>

            <strong>
              {{ peak.value | number }}
              lượt xem
            </strong>
          </div>
        }

        <div class="axis-labels">
          @for (label of axisLabels(); track label.id) {
            <span>
              {{ label.label }}
            </span>
          }
        </div>
      </div>
    </section>
  `,

  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .dashboard-card {
        border: 1px solid var(--border);
        border-radius: 12px;
        background: linear-gradient(145deg, rgba(16, 22, 39, 0.95), rgba(10, 15, 28, 0.95));
        box-shadow: 0 14px 35px rgba(0, 0, 0, 0.15);
      }

      .chart-card {
        min-height: 340px;
        padding: 20px 22px 14px;
      }

      header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
      }

      h2 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        color: var(--text-strong);
        font-size: 1.1rem;
        font-weight: 700;
      }

      h2 span {
        display: grid;
        width: 18px;
        height: 18px;
        place-items: center;
        border: 1px solid rgba(151, 162, 188, 0.5);
        border-radius: 50%;
        color: var(--text-muted);
        font-size: 11px;
      }

      header p {
        margin: 5px 0 0;
        color: var(--text-secondary);
        font-size: 13px;
      }

      .chart-wrap {
        position: relative;
        margin-top: 12px;
      }

      .chart {
        display: block;
        width: 100%;
        height: 220px;
        overflow: visible;
      }

      .grid-line {
        stroke: rgba(133, 147, 181, 0.14);
        stroke-dasharray: 4 4;
        stroke-width: 1;
      }

      .grid-label {
        fill: var(--text-muted);
        font-size: 12px;
      }

      .axis-labels {
        display: flex;
        justify-content: space-between;
        padding: 0 5px 0 43px;
        color: var(--text-muted);
        font-size: 12px;
      }

      .chart-tooltip {
        position: absolute;
        display: grid;
        min-width: 130px;
        gap: 3px;
        padding: 8px 12px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: rgba(12, 18, 35, 0.95);
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
        transform: translateX(-50%);
        pointer-events: none;
        z-index: 10;
      }

      .chart-tooltip::after {
        position: absolute;
        bottom: -22px;
        left: 50%;
        width: 1px;
        height: 22px;
        content: '';
        background: rgba(172, 95, 255, 0.48);
      }

      .chart-tooltip small {
        color: var(--text-muted);
        font-size: 11.5px;
      }

      .chart-tooltip strong {
        color: var(--text-strong);
        font-size: 13px;
        font-weight: 700;
      }

      .chart-tooltip strong::before {
        display: inline-block;
        width: 7px;
        height: 7px;
        margin-right: 5px;
        border-radius: 50%;
        content: '';
        background: #b45dff;
        box-shadow: 0 0 7px rgba(180, 93, 255, 0.6);
      }
    `,
  ],
})
export class ReadershipChartComponent {
  private readonly pointsState = signal<readonly ReadershipChartPoint[]>([]);

  @Input({ required: true })
  set points(value: readonly ReadershipChartPoint[]) {
    this.pointsState.set(value);
  }

  @Input()
  period: AuthorStudioPeriod = '30d';

  @Output()
  readonly periodChange = new EventEmitter<AuthorStudioPeriod>();

  protected readonly periodOptions = PERIOD_OPTIONS;

  protected readonly gridLines = [
    {
      value: 20000,
      label: '20K',
      y: 25,
    },
    {
      value: 15000,
      label: '15K',
      y: 68,
    },
    {
      value: 10000,
      label: '10K',
      y: 111,
    },
    {
      value: 5000,
      label: '5K',
      y: 154,
    },
    {
      value: 0,
      label: '0',
      y: 197,
    },
  ] as const;

  protected readonly positionedPoints = computed(() => {
    const points = this.pointsState();

    if (points.length === 0) {
      return [];
    }

    const left = 43;
    const right = 744;
    const top = 25;
    const bottom = 197;
    const maximum = 20000;

    return points.map((point, index) => {
      const ratio = points.length === 1 ? 0 : index / (points.length - 1);

      return {
        ...point,

        x: left + ratio * (right - left),

        y: bottom - (Math.min(point.value, maximum) / maximum) * (bottom - top),
      };
    });
  });

  protected readonly linePoints = computed(() =>
    this.positionedPoints()
      .map((point) => `${point.x},${point.y}`)
      .join(' '),
  );

  protected readonly areaPoints = computed(() => {
    const points = this.positionedPoints();

    if (points.length === 0) {
      return '';
    }

    return [`43,197`, ...points.map((point) => `${point.x},${point.y}`), `744,197`].join(' ');
  });

  protected readonly peakPoint = computed(() => {
    const points = this.positionedPoints();

    if (points.length === 0) {
      return null;
    }

    const peak = points.reduce((current, point) => (point.value > current.value ? point : current));

    return {
      ...peak,
      leftPercent: (peak.x / 760) * 100,

      tooltipTop: Math.max(0, (peak.y * 220) / 225 - 62),
    };
  });

  protected readonly axisLabels = computed(() => {
    const points = this.pointsState();

    if (points.length === 0) {
      return [];
    }

    const desiredCount = 6;

    return Array.from(
      {
        length: desiredCount,
      },
      (_, index) => {
        const pointIndex = Math.round((index * (points.length - 1)) / (desiredCount - 1));

        return points[pointIndex];
      },
    );
  });

  protected get selectedPeriodLabel(): string {
    switch (this.period) {
      case '7d':
        return '7 ngày qua';

      case '90d':
        return '90 ngày qua';

      case '30d':
      default:
        return '30 ngày qua';
    }
  }
}

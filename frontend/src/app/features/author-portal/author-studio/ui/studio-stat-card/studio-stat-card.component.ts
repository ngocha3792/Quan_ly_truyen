import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { AuthorStudioMetric } from '../../domain/author-studio.models';
import { StudioIconComponent } from '../studio-icon/studio-icon.component';

@Component({
  selector: 'app-studio-stat-card',
  standalone: true,

  imports: [StudioIconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <article class="metric-card" [attr.data-tone]="metric.tone">
      <span class="metric-icon">
        <app-studio-icon [name]="metric.icon" [size]="22"></app-studio-icon>
      </span>

      <div class="metric-information">
        <span>{{ metric.title }}</span>

        <strong>{{ metric.value }}</strong>
      </div>

      <p [class.metric-trend--down]="metric.trendDirection === 'down'">
        <app-studio-icon
          [name]="metric.trendDirection === 'up' ? 'arrow-up' : 'arrow-down'"
          [size]="13"
        ></app-studio-icon>

        <strong>
          {{ metric.trendValue }}
        </strong>

        {{ metric.trendLabel }}
      </p>
    </article>
  `,

  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        height: 100%;
      }

      .metric-card {
        position: relative;
        display: grid;
        height: 100%;
        min-height: 110px;
        grid-template-columns: 40px minmax(0, 1fr);
        align-items: center;
        gap: 10px;
        padding: 14px 14px 12px;
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: linear-gradient(145deg, rgba(16, 22, 39, 0.95), rgba(10, 15, 28, 0.95));
        box-shadow: 0 14px 35px rgba(0, 0, 0, 0.15);
      }

      .metric-card::after {
        position: absolute;
        right: -35px;
        bottom: -55px;
        width: 120px;
        height: 120px;
        border-radius: 50%;
        content: '';
        background: rgba(139, 92, 246, 0.06);
        filter: blur(5px);
      }

      .metric-icon {
        display: grid;
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        place-items: center;
        border-radius: 50%;
        background: rgba(127, 60, 218, 0.2);
        color: #b667ff;
      }

      .metric-card[data-tone='blue'] .metric-icon {
        background: rgba(37, 99, 235, 0.2);
        color: #4f83ff;
      }

      .metric-card[data-tone='orange'] .metric-icon {
        background: rgba(217, 119, 6, 0.2);
        color: #f59e0b;
      }

      .metric-card[data-tone='indigo'] .metric-icon {
        background: rgba(79, 70, 229, 0.2);
        color: #6386ff;
      }

      .metric-card[data-tone='pink'] .metric-icon {
        background: rgba(168, 85, 247, 0.19);
        color: #c05cff;
      }

      .metric-card[data-tone='green'] .metric-icon {
        background: rgba(22, 163, 74, 0.18);
        color: #4ade80;
      }

      .metric-information {
        min-width: 0;
        overflow: hidden;
      }

      .metric-information span {
        display: block;
        overflow: hidden;
        color: var(--text-secondary);
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .metric-information strong {
        display: block;
        margin-top: 3px;
        color: #f8f6fb;
        font-size: clamp(14px, 1.15vw, 20px);
        font-weight: 700;
        letter-spacing: -0.3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      p {
        display: flex;
        grid-column: 1 / -1;
        align-items: center;
        gap: 4px;
        margin: 4px 0 0;
        color: var(--text-muted);
        font-size: 11px;
        white-space: nowrap;
      }

      p strong {
        color: #4ade80;
      }

      .metric-trend--down strong,
      .metric-trend--down {
        color: #fb5b65;
      }
    `,
  ],
})
export class StudioStatCardComponent {
  @Input({ required: true })
  metric!: AuthorStudioMetric;
}

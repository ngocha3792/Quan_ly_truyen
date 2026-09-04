import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { IconComponent } from '../../../../../../shared/components/icon/icon.component';

import { SecurityLevel, SecurityScore } from '../../data/account-security.models';

@Component({
  selector: 'app-security-score-card',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="score-card" [attr.data-level]="score().level" [style]="cardVars()">
      <div class="score-title">
        <strong>Mức độ bảo mật</strong>

        <app-icon name="info" [size]="15" />
      </div>

      <div class="score-ring" [style]="ringStyle()">
        <div class="score-ring-inner">
          <strong> {{ score().percent }}% </strong>

          <span>
            {{ score().label }}
          </span>
        </div>
      </div>

      <p class="score-description">
        {{ score().description }}
      </p>

      <div class="score-progress">
        <span [style.width.%]="score().percent"></span>
      </div>

      <div class="score-items">
        @for (item of score().items; track item.id) {
          <div class="score-item">
            <span class="item-status" [class.completed]="item.completed">
              @if (item.completed) {
                <app-icon name="check" [size]="12" />
              }
            </span>

            <div>
              <strong>
                {{ item.label }}
              </strong>

              <small>
                {{ item.description }}
              </small>
            </div>
          </div>
        }
      </div>

      <button class="suggestion-button" type="button" (click)="suggestionsRequested.emit()">
        <app-icon name="shield" [size]="16" />

        Xem gợi ý bảo mật
      </button>
    </aside>
  `,
  styles: `
    .score-card {
      padding: 24px 20px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: linear-gradient(145deg, rgba(17, 25, 44, 0.98), rgba(10, 16, 31, 0.98));
      box-shadow: 0 18px 45px rgba(0, 0, 0, 0.12);
    }

    .score-title {
      display: flex;
      align-items: center;
      gap: 7px;
      color: #f8fafc;
      font-size: 14.5px;
      font-weight: 700;
    }

    .score-title app-icon {
      color: #94a3b8;
    }

    .score-ring {
      width: 136px;
      height: 136px;
      margin: 24px auto 20px;
      padding: 10px;
      border-radius: 50%;
      transition: box-shadow 220ms ease;
    }

    .score-ring-inner {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 4px;
      border-radius: 50%;
      background: #131b2e;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
    }

    .score-ring-inner strong {
      color: #f8fafc;
      font-size: 30px;
      font-weight: 750;
      letter-spacing: -0.02em;
    }

    .score-ring-inner span {
      color: var(--score-accent, #94a3b8);
      font-size: 12px;
      font-weight: 650;
    }

    .score-description {
      margin: 0;
      text-align: center;
      color: #94a3b8;
      font-size: 12.5px;
      line-height: 1.55;
    }

    .score-progress {
      height: 6px;
      margin: 20px 0 24px;
      overflow: hidden;
      border-radius: 20px;
      background: #252d40;
    }

    .score-progress span {
      height: 100%;
      display: block;
      border-radius: inherit;
      background: linear-gradient(
        90deg,
        var(--score-accent-dim, #733cdd),
        var(--score-accent, #ad58ef)
      );
      transition: width 220ms ease;
    }

    .score-items {
      display: grid;
      gap: 16px;
    }

    .score-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 11px;
    }

    .item-status {
      width: 22px;
      height: 22px;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      border: 1.5px solid #3a4358;
      border-radius: 50%;
      color: #4ade80;
    }

    .item-status.completed {
      border-color: transparent;
      color: #0f1a12;
      background: #4ade80;
    }

    .score-item div {
      display: grid;
      gap: 3px;
    }

    .score-item strong {
      color: #f8fafc;
      font-size: 13.5px;
      font-weight: 600;
    }

    .score-item small {
      color: #94a3b8;
      font-size: 12px;
    }

    .suggestion-button {
      width: 100%;
      min-height: 42px;
      margin-top: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 1px solid #7543c7;
      border-radius: 7px;
      color: #c084fc;
      font-size: 13px;
      font-weight: 650;
      cursor: pointer;
      background: transparent;
      transition:
        color 150ms ease,
        background 150ms ease;
    }

    .suggestion-button:hover {
      color: #fff;
      background: rgba(125, 67, 211, 0.14);
    }
  `,
})
export class SecurityScoreCardComponent {
  readonly score = input.required<SecurityScore>();

  readonly suggestionsRequested = output<void>();

  private static readonly LEVEL_PALETTE: Record<
    SecurityLevel,
    { readonly accent: string; readonly accentDim: string; readonly glow: string }
  > = {
    low: { accent: '#f87171', accentDim: '#c0392b', glow: 'rgba(248, 113, 113, 0.28)' },
    medium: { accent: '#fbbf24', accentDim: '#b8790a', glow: 'rgba(251, 191, 36, 0.26)' },
    good: { accent: '#a970ff', accentDim: '#733cdd', glow: 'rgba(149, 82, 236, 0.28)' },
    excellent: { accent: '#4ade80', accentDim: '#1f9d55', glow: 'rgba(74, 222, 128, 0.28)' },
  };

  private readonly palette = computed(
    () => SecurityScoreCardComponent.LEVEL_PALETTE[this.score().level],
  );

  readonly ringBackground = computed(() => {
    const percent = this.score().percent;
    const { accent } = this.palette();

    return [
      'conic-gradient(',
      `${accent} 0%,`,
      `${accent} ${percent}%,`,
      'rgba(86, 98, 127, .2)',
      `${percent}%,`,
      'rgba(86, 98, 127, .2) 100%',
      ')',
    ].join(' ');
  });

  readonly ringStyle = computed(() => ({
    background: this.ringBackground(),
    'box-shadow': `0 0 0 1px rgba(255, 255, 255, 0.02), 0 8px 22px ${this.palette().glow}`,
  }));

  readonly cardVars = computed(() => ({
    '--score-accent': this.palette().accent,
    '--score-accent-dim': this.palette().accentDim,
  }));
}

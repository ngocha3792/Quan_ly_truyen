import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    output,
} from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

import { SecurityScore } from '../../data/account-security.models';

@Component({
    selector:
        'app-security-score-card',
    standalone: true,
    imports: [IconComponent],
    changeDetection:
        ChangeDetectionStrategy.OnPush,
    template: `
    <aside
      class="score-card"
      [attr.data-level]="
        score().level
      "
    >
      <div class="score-title">
        <strong>Mức độ bảo mật</strong>

        <app-icon
          name="info"
          [size]="15"
        />
      </div>

      <div
        class="score-ring"
        [style.background]="
          ringBackground()
        "
      >
        <div class="score-ring-inner">
          <strong>
            {{ score().percent }}%
          </strong>

          <span>
            {{ score().label }}
          </span>
        </div>
      </div>

      <p class="score-description">
        {{ score().description }}
      </p>

      <div class="score-progress">
        <span
          [style.width.%]="
            score().percent
          "
        ></span>
      </div>

      <div class="score-items">
        @for (
          item of score().items;
          track item.id
        ) {
          <div class="score-item">
            <span
              class="item-status"
              [class.completed]="
                item.completed
              "
            >
              @if (item.completed) {
                <app-icon
                  name="check"
                  [size]="12"
                />
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

      <button
        class="suggestion-button"
        type="button"
        (click)="suggestionsRequested.emit()"
      >
        <app-icon
          name="shield"
          [size]="16"
        />

        Xem gợi ý bảo mật
      </button>
    </aside>
  `,
    styles: `
    .score-card {
      padding: 22px 20px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background:
        linear-gradient(
          145deg,
          rgba(17, 25, 44, .98),
          rgba(10, 16, 31, .98)
        );
      box-shadow:
        0 18px 45px rgba(0, 0, 0, .12);
    }

    .score-title {
      display: flex;
      align-items: center;
      gap: 7px;
      color: #efedf4;
      font-size: 12px;
    }

    .score-title app-icon {
      color: #747e93;
    }

    .score-ring {
      width: 128px;
      height: 128px;
      margin: 25px auto 17px;
      padding: 8px;
      border-radius: 50%;
    }

    .score-ring-inner {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 5px;
      border-radius: 50%;
      background: #11192b;
    }

    .score-ring-inner strong {
      color: #f6f4fa;
      font-size: 27px;
    }

    .score-ring-inner span {
      color: #929bad;
      font-size: 10px;
    }

    .score-description {
      margin: 0;
      text-align: center;
      color: #818b9f;
      font-size: 10px;
      line-height: 1.55;
    }

    .score-progress {
      height: 6px;
      margin: 19px 0 24px;
      overflow: hidden;
      border-radius: 20px;
      background: #252d40;
    }

    .score-progress span {
      height: 100%;
      display: block;
      border-radius: inherit;
      background:
        linear-gradient(
          90deg,
          #733cdd,
          #ad58ef
        );
    }

    .score-items {
      display: grid;
      gap: 17px;
    }

    .score-item {
      display: grid;
      grid-template-columns:
        auto minmax(0, 1fr);
      align-items: center;
      gap: 11px;
    }

    .item-status {
      width: 19px;
      height: 19px;
      display: grid;
      place-items: center;
      border: 1px solid #465067;
      border-radius: 50%;
      color: #4ade80;
    }

    .item-status.completed {
      border-color:
        rgba(34, 197, 94, .15);
      background:
        rgba(34, 197, 94, .15);
    }

    .score-item div {
      display: grid;
      gap: 3px;
    }

    .score-item strong {
      color: #dbd9e1;
      font-size: 10px;
    }

    .score-item small {
      color: #687286;
      font-size: 9px;
    }

    .suggestion-button {
      width: 100%;
      min-height: 40px;
      margin-top: 25px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 1px solid #7543c7;
      border-radius: 7px;
      color: #be82ff;
      font-size: 10px;
      font-weight: 750;
      cursor: pointer;
      background: transparent;
    }

    .suggestion-button:hover {
      color: #fff;
      background:
        rgba(125, 67, 211, .14);
    }
  `,
})
export class SecurityScoreCardComponent {
    readonly score =
        input.required<SecurityScore>();

    readonly suggestionsRequested =
        output<void>();

    readonly ringBackground =
        computed(() => {
            const percent =
                this.score().percent;

            return [
                'conic-gradient(',
                '#9552ec 0%,',
                `#9552ec ${percent}%,`,
                'rgba(86, 98, 127, .2)',
                `${percent}%,`,
                'rgba(86, 98, 127, .2) 100%',
                ')',
            ].join(' ');
        });
}
import {
    ChangeDetectionStrategy,
    Component,
    output,
} from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
    selector:
        'app-genre-recommendation-card',

    standalone: true,

    imports: [IconComponent],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <section class="recommendation-card">
      <div>
        <h2>Không biết đọc gì?</h2>

        <p>
          Khám phá truyện phù hợp với sở thích
          của bạn chỉ trong vài giây.
        </p>

        <button
          type="button"
          (click)="requested.emit()"
        >
          <app-icon
            name="wand"
            [size]="15"
          />

          Tìm truyện cho tôi
        </button>
      </div>

      <span class="visual">
        <app-icon
          name="wand"
          [size]="38"
        />
      </span>
    </section>
  `,

    styles: `
    .recommendation-card {
      position: relative;
      min-height: 116px;
      padding: 16px;
      overflow: hidden;
      display: grid;
      grid-template-columns:
        minmax(0, 1fr) auto;
      gap: 10px;
      border: 1px solid
        rgba(137, 72, 213, .3);
      border-radius: 10px;
      background:
        radial-gradient(
          circle at 95% 80%,
          rgba(150, 74, 225, .3),
          transparent 115px
        ),
        linear-gradient(
          145deg,
          #321069,
          #231044
        );
    }

    h2 {
      margin: 0;
      color: #d39bff;
      font-size: .9375rem;
    }

    p {
      max-width: 185px;
      margin: 8px 0 12px;
      color: #aa8cc4;
      font-size: .6875rem;
      line-height: 1.55;
    }

    button {
      min-height: 34px;
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 0;
      border-radius: 6px;
      color: #fff;
      font-size: .75rem;
      font-weight: 750;
      cursor: pointer;
      background:
        linear-gradient(
          135deg,
          #9850e6,
          #bd6afa
        );
    }

    .visual {
      width: 66px;
      height: 66px;
      align-self: end;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: #bd73f6;
      background:
        rgba(146, 73, 217, .16);
      transform: rotate(-12deg);
    }
  `,
})
export class GenreRecommendationCardComponent {
    readonly requested = output<void>();
}
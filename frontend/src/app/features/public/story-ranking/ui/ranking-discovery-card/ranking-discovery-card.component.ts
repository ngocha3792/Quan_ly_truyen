import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-ranking-discovery-card',

  standalone: true,

  imports: [RouterLink, IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="discovery-card">
      <div>
        <h2>Khám phá truyện theo gu của bạn ✨</h2>

        <p>Nhận đề xuất truyện phù hợp với sở thích đọc của bạn mỗi ngày.</p>

        <a
          routerLink="/danh-sach"
          [queryParams]="{
            sort: 'popular',
          }"
        >
          Bắt đầu khám phá

          <app-icon name="chevron-right" [size]="14" />
        </a>
      </div>

      <span class="visual">
        <app-icon name="sparkles" [size]="37" />
      </span>
    </section>
  `,

  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .discovery-card {
      position: relative;
      min-height: 125px;
      padding: 1.25rem;
      overflow: hidden;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1rem;
      border: 1px solid rgba(132, 65, 205, 0.31);
      border-radius: 12px;
      background:
        radial-gradient(circle at 95% 85%, rgba(166, 84, 230, 0.32), transparent 100px),
        linear-gradient(145deg, #25103f, #151126);
    }

    h2 {
      margin: 0;
      color: #f0dbff;
      font-size: 0.95rem;
      line-height: 1.45;
    }

    p {
      max-width: 190px;
      margin: 0.5rem 0 0.75rem;
      color: #a886bd;
      font-size: 0.75rem;
      line-height: 1.5;
    }

    a {
      min-height: 34px;
      width: max-content;
      padding: 0 0.875rem;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 6px;
      color: #fff;
      font-size: 0.8125rem;
      font-weight: 750;
      text-decoration: none;
      background: linear-gradient(135deg, #8542d6, #a957e8);
    }

    .visual {
      width: 67px;
      height: 67px;
      align-self: end;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: #be7bf4;
      background: rgba(143, 70, 206, 0.14);
    }
  `,
})
export class RankingDiscoveryCardComponent {}

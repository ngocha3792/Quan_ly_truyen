import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ChapterReaderView } from '../../domain/chapter-reader.models';

@Component({
  selector: 'app-chapter-heading',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <header class="chapter-heading">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a routerLink="/">Trang chủ</a>

        <span>/</span>

        <a [routerLink]="['/truyen', data.story.slug]">
          {{ data.story.title }}
        </a>

        <span>/</span>

        <strong> Chương {{ data.chapter.number }} </strong>
      </nav>

      <h1>
        {{ data.story.title }}
      </h1>

      <div class="chapter-title">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"
          ></path>

          <path d="M8 8h8"></path>
          <path d="M8 12h8"></path>
          <path d="M8 16h5"></path>
        </svg>

        <h2>
          Chương {{ data.chapter.number }}:
          {{ data.chapter.title }}
        </h2>
      </div>
    </header>
  `,

  styles: [
    `
      :host {
        display: block;
      }

      .chapter-heading {
        margin-bottom: 18px;
      }

      .breadcrumb {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 9px;
        margin-bottom: 18px;
        color: #7f89a5;
        font-size: 13px;
      }

      .breadcrumb a {
        color: #a991d4;
        text-decoration: none;
      }

      .breadcrumb a:hover {
        color: #c084fc;
      }

      .breadcrumb strong {
        color: #c7ccda;
        font-weight: 500;
      }

      h1 {
        margin: 0 0 17px;
        color: #f7f5ff;
        font-size: clamp(25px, 2.2vw, 34px);
        line-height: 1.25;
        letter-spacing: -0.7px;
      }

      .chapter-title {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .chapter-title svg {
        width: 24px;
        height: 24px;
        flex: 0 0 auto;
        fill: none;
        stroke: #b967ff;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .chapter-title h2 {
        margin: 0;
        color: #f3f1fa;
        font-size: clamp(19px, 1.7vw, 25px);
        line-height: 1.4;
        letter-spacing: -0.35px;
      }

      @media (max-width: 640px) {
        .breadcrumb {
          font-size: 12px;
        }

        h1 {
          margin-bottom: 12px;
        }

        .chapter-title {
          align-items: flex-start;
        }
      }
    `,
  ],
})
export class ChapterHeadingComponent {
  @Input({ required: true })
  data!: ChapterReaderView;
}

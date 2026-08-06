import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../shared/pipes/compact-number.pipe';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';

import { StoryUpdateItem } from '../../domain/story-updates.models';

@Component({
    selector: 'app-featured-update-card',
    standalone: true,
    imports: [
        RouterLink,
        IconComponent,
        CompactNumberPipe,
        RelativeTimePipe,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <a
      class="featured-card"
      [routerLink]="['/truyen', story().slug]"
    >
      <img
        [src]="story().bannerUrl || story().coverUrl"
        [alt]="story().title"
      />

      <span class="overlay"></span>

      <div class="featured-content">
        <span class="featured-badge">Nổi bật</span>

        <h2>{{ story().title }}</h2>

        <div class="genres">
          @for (genre of story().genres; track genre.slug) {
            <span>{{ genre.name }}</span>
          }
        </div>

        @if (story().description) {
          <p>{{ story().description }}</p>
        }

        <div class="footer-row">
          <div>
            <span class="chapter">
              Ch.{{ story().latestChapter }}
            </span>

            <span>
              {{ story().updatedAt | relativeTime }}
            </span>
          </div>

          <div>
            <span>
              <app-icon name="eye" [size]="14" />
              {{ story().viewCount | compactNumber }}
            </span>

            <span>
              <app-icon name="message-circle" [size]="14" />
              {{ story().commentCount | compactNumber }}
            </span>
          </div>
        </div>
      </div>
    </a>
  `,
    styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .featured-card {
      position: relative;
      min-height: 200px;
      display: block;
      overflow: hidden;
      border: 1px solid rgba(139, 83, 219, .35);
      border-radius: 12px;
      color: inherit;
      text-decoration: none;
      background: #0f1627;
      box-shadow: 0 12px 30px rgba(0, 0, 0, .2);
    }

    img {
      position: absolute;
      inset: 0;
      width: 45%;
      height: 100%;
      object-fit: cover;
      object-position: center top;
      transition: transform 280ms ease;
    }

    .featured-card:hover img {
      transform: scale(1.04);
    }

    .overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        rgba(13, 7, 35, .1),
        rgba(15, 11, 39, .82) 42%,
        rgba(13, 14, 34, .98) 65%
      );
    }

    .featured-content {
      position: relative;
      z-index: 2;
      min-height: 200px;
      padding: 1.25rem;
      margin-left: 35%;
      display: flex;
      align-items: flex-start;
      flex-direction: column;
    }

    .featured-badge {
      padding: 4px 8px;
      border-radius: 4px;
      color: #fff;
      font-size: .75rem;
      font-weight: 700;
      text-transform: uppercase;
      background: linear-gradient(135deg, #7d3fe0, #a553ec);
    }

    h2 {
      margin: 8px 0 0;
      color: #f5f2f7;
      font-size: 1.35rem;
      font-weight: 700;
      line-height: 1.25;
    }

    .genres {
      margin-top: 6px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .genres span {
      padding: 2px 8px;
      border-radius: 4px;
      color: #9a9fac;
      font-size: .8rem;
      background: rgba(90, 102, 132, .2);
    }

    p {
      max-width: 520px;
      margin: 8px 0 0;
      color: #8d96a8;
      font-size: .875rem;
      line-height: 1.5;
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .footer-row {
      width: 100%;
      margin-top: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: #858fa2;
      font-size: .85rem;
    }

    .footer-row > div {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .footer-row span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .chapter {
      padding: 4px 8px;
      border-radius: 4px;
      color: #fff;
      font-size: .8rem;
      font-weight: 700;
      background: rgba(111, 54, 187, .75);
    }

    @media (max-width: 650px) {
      img {
        width: 100%;
        opacity: .35;
      }

      .overlay {
        background: linear-gradient(
          90deg,
          rgba(11, 9, 30, .85),
          rgba(11, 12, 29, .98)
        );
      }

      .featured-content {
        margin-left: 0;
      }
    }
  `,
})
export class FeaturedUpdateCardComponent {
    readonly story = input.required<StoryUpdateItem>();
}
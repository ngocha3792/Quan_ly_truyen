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
    selector: 'app-update-story-card',
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
      class="story-card"
      [routerLink]="['/truyen', story().slug]"
    >
      <div class="cover-wrapper">
        <img
          [src]="story().coverUrl"
          [alt]="story().title"
          loading="lazy"
        />

        @if (story().badge) {
          <span
            class="badge"
            [attr.data-badge]="story().badge"
          >
            {{
              story().badge === 'hot'
                ? 'HOT'
                : story().badge === 'new'
                  ? 'NEW'
                  : 'NỔI BẬT'
            }}
          </span>
        }
      </div>

      <div class="story-content">
        <div>
          <h3>{{ story().title }}</h3>

          <div class="genres">
            @for (genre of story().genres.slice(0, 2); track genre.slug) {
              <span>{{ genre.name }}</span>
            }
          </div>
        </div>

        <div class="bottom-row">
          <div class="chapter-row">
            <strong>Ch. {{ story().latestChapter }}</strong>
            <span class="time">{{ story().updatedAt | relativeTime }}</span>
          </div>

          <div class="meta-row">
            <span>
              <app-icon name="eye" [size]="13" />
              {{ story().viewCount | compactNumber }}
            </span>

            <span>
              <app-icon name="message-circle" [size]="13" />
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

    .story-card {
      min-height: 125px;
      padding: 12px;
      display: grid;
      grid-template-columns: 85px minmax(0, 1fr);
      gap: 14px;
      border: 1px solid var(--border, rgba(132, 145, 177, .16));
      border-radius: 12px;
      color: inherit;
      text-decoration: none;
      background: linear-gradient(145deg, rgba(16, 24, 42, .95), rgba(9, 15, 29, .95));
      transition: transform 170ms ease, border-color 170ms ease;
    }

    .story-card:hover {
      transform: translateY(-2px);
      border-color: rgba(158, 97, 241, .4);
    }

    .cover-wrapper {
      position: relative;
      width: 85px;
      height: 115px;
      flex-shrink: 0;
      overflow: hidden;
      border-radius: 8px;
      background: #111827;
    }

    img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }

    .badge {
      position: absolute;
      z-index: 2;
      top: 6px;
      left: 6px;
      padding: 2px 6px;
      border-radius: 4px;
      color: #fff;
      font-size: .65rem;
      font-weight: 850;
      background: #8b44e5;
    }

    .badge[data-badge='hot'] {
      background: #e43c56;
    }

    .badge[data-badge='new'] {
      background: #7740de;
    }

    .story-content {
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    h3 {
      margin: 0;
      overflow: hidden;
      color: #eeebf2;
      font-size: 1rem;
      font-weight: 700;
      line-height: 1.35;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .genres {
      margin-top: 6px;
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .genres span {
      padding: 2px 7px;
      border-radius: 4px;
      color: #858fa2;
      font-size: .75rem;
      background: rgba(76, 89, 118, .18);
    }

    .bottom-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .chapter-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .chapter-row strong {
      padding: 3px 7px;
      border-radius: 4px;
      color: #fff;
      font-size: .75rem;
      font-weight: 700;
      background: rgba(111, 54, 187, .75);
    }

    .time {
      color: #7b8599;
      font-size: .75rem;
    }

    .meta-row {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .meta-row span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #7f899c;
      font-size: .75rem;
    }
  `,
})
export class UpdateStoryCardComponent {
    readonly story = input.required<StoryUpdateItem>();
}
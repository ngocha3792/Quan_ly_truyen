import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';

import { LibraryStory, LibraryViewMode } from '../../domain/my-library.models';

@Component({
  selector: 'app-library-story-list',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="story-collection" [class.story-collection--list]="viewMode === 'list'">
      @for (story of stories; track story.id) {
        <article class="story-card">
          <a
            class="story-cover"
            [attr.data-tone]="story.coverTone"
            [routerLink]="['/truyen', story.slug]"
          >
            <span class="cover-initials">
              {{ story.coverInitials }}
            </span>

            <span class="status-badge" [attr.data-status]="getStatusKey(story)">
              {{ getStatusLabel(story) }}
            </span>
          </a>

          <div class="story-information">
            <a class="story-title" [routerLink]="['/truyen', story.slug]">
              {{ story.title }}
            </a>

            <p class="story-author">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="3"></circle>

                <path d="M5 20c.5-4 2.8-6 7-6s6.5 2 7 6"></path>
              </svg>

              {{ story.author }}
            </p>

            <div class="genre-list">
              @for (genre of story.genres; track genre) {
                <span>{{ genre }}</span>
              }
            </div>

            <div class="chapter-row">
              <strong> Chương {{ story.currentChapter }} </strong>

              <span> {{ story.progress }}% </span>
            </div>

            <div class="progress-track">
              <span [style.width.%]="story.progress"></span>
            </div>

            <p class="last-read">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9"></circle>

                <path d="M12 7v5l3 2"></path>
              </svg>

              @if (story.isCompleted) {
                Đã hoàn thành:
              } @else {
                Đọc lần cuối:
              }

              {{ story.lastReadLabel }}
            </p>

            <div class="story-actions">
              <a
                class="continue-button"
                [routerLink]="['/truyen', story.slug, 'chuong', story.currentChapter]"
              >
                @if (story.isCompleted) {
                  <svg viewBox="0 0 24 24">
                    <path d="M3 12a9 9 0 1 0 3-6.7"></path>

                    <path d="M3 4v6h6"></path>
                  </svg>

                  Xem lại
                } @else if (story.isReading) {
                  <svg viewBox="0 0 24 24">
                    <path d="m8 5 11 7-11 7V5Z"></path>
                  </svg>

                  Đọc tiếp
                } @else {
                  <svg viewBox="0 0 24 24">
                    <path d="m8 5 11 7-11 7V5Z"></path>
                  </svg>

                  Đọc ngay
                }
              </a>

              <button
                class="favorite-button"
                type="button"
                [class.favorite-button--active]="story.isFavorite"
                [attr.aria-label]="story.isFavorite ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'"
                (click)="favoriteToggle.emit(story.id)"
              >
                <svg viewBox="0 0 24 24">
                  <path
                    d="M12 21s-7-4.4-7-11a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 6.6-7 11-7 11Z"
                  ></path>
                </svg>
              </button>
            </div>
          </div>
        </article>
      } @empty {
        <app-empty-state
          class="library-empty"
          icon="book"
          [iconSize]="30"
          title="Không tìm thấy truyện"
          description="Thư viện không có truyện phù hợp với bộ lọc hiện tại."
        />
      }
    </section>
  `,

  styles: [
    `
      .story-collection {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        padding: 16px 20px;
      }

      .story-card {
        display: grid;
        min-width: 0;
        grid-template-columns:
          120px
          minmax(0, 1fr);
        gap: 16px;
        min-height: 155px;
        padding: 12px;
        border: 1px solid rgba(139, 151, 190, 0.16);
        border-radius: 10px;
        background: linear-gradient(145deg, rgba(17, 24, 45, 0.88), rgba(10, 16, 31, 0.88));
      }

      .story-card:hover {
        border-color: rgba(192, 132, 252, 0.38);
        background: linear-gradient(145deg, rgba(22, 27, 51, 0.95), rgba(12, 18, 35, 0.95));
      }

      .story-cover {
        position: relative;
        display: grid;
        min-height: 135px;
        place-items: center;
        overflow: hidden;
        border-radius: 8px;
        background: linear-gradient(145deg, #2563eb, #10162b);
        color: #ffffff;
        text-decoration: none;
        isolation: isolate;
      }

      .story-cover::before,
      .story-cover::after {
        position: absolute;
        content: '';
        z-index: -1;
      }

      .story-cover::before {
        right: -25px;
        bottom: -18px;
        width: 110px;
        height: 110px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.16);
        filter: blur(5px);
      }

      .story-cover::after {
        right: -5px;
        bottom: -12px;
        left: -5px;
        height: 78px;
        background: rgba(4, 8, 18, 0.56);
        clip-path: polygon(
          0 100%,
          15% 50%,
          32% 72%,
          50% 29%,
          69% 67%,
          84% 35%,
          100% 59%,
          100% 100%
        );
      }

      .story-cover[data-tone='violet'] {
        background: linear-gradient(145deg, #9333ea, #23103d);
      }

      .story-cover[data-tone='orange'] {
        background: linear-gradient(145deg, #f97316, #29120a);
      }

      .story-cover[data-tone='gold'] {
        background: linear-gradient(145deg, #d4a72c, #34240a);
      }

      .story-cover[data-tone='cyan'] {
        background: linear-gradient(145deg, #0891b2, #102536);
      }

      .story-cover[data-tone='silver'] {
        background: linear-gradient(145deg, #cbd5e1, #273143);
        color: #111827;
      }

      .story-cover[data-tone='crimson'] {
        background: linear-gradient(145deg, #e11d48, #2f1019);
      }

      .story-cover[data-tone='indigo'] {
        background: linear-gradient(145deg, #6366f1, #171839);
      }

      .cover-initials {
        font-size: 30px;
        font-weight: 900;
        letter-spacing: -2px;
      }

      .status-badge {
        position: absolute;
        top: 8px;
        left: 8px;
        padding: 4px 9px;
        border-radius: 5px;
        background: #22c55e;
        color: #ffffff;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.03em;
      }

      .status-badge[data-status='favorite'] {
        background: #ec4899;
      }

      .status-badge[data-status='completed'] {
        background: #d4a72c;
      }

      .status-badge[data-status='following'] {
        background: #14b8a6;
      }

      .story-information {
        display: flex;
        min-width: 0;
        flex-direction: column;
      }

      .story-title {
        overflow: hidden;
        color: var(--text-strong);
        font-size: 16px;
        font-weight: 700;
        line-height: 1.35;
        text-decoration: none;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .story-title:hover {
        color: var(--primary-soft);
      }

      .story-author {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 4px 0 6px;
        color: #a855f7;
        font-size: 13px;
        font-weight: 600;
      }

      .story-author svg {
        width: 14px;
        height: 14px;
      }

      .genre-list {
        display: flex;
        min-height: 22px;
        flex-wrap: wrap;
        gap: 5px;
      }

      .genre-list span {
        padding: 3px 8px;
        border-radius: 5px;
        background: rgba(140, 77, 232, 0.15);
        color: #a4adca;
        font-size: 11.5px;
      }

      .chapter-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-top: 8px;
      }

      .chapter-row strong,
      .chapter-row span {
        color: var(--text-strong);
        font-size: 13.5px;
        font-weight: 700;
      }

      .progress-track {
        height: 7px;
        margin-top: 4px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(105, 116, 145, 0.22);
      }

      .progress-track span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #7c3aed, #b967ff);
        box-shadow: 0 0 9px rgba(168, 85, 247, 0.35);
      }

      .last-read {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 6px 0 0;
        color: var(--text-muted);
        font-size: 12.5px;
      }

      .last-read svg {
        width: 14px;
        height: 14px;
      }

      .story-actions {
        display: grid;
        grid-template-columns: minmax(110px, 1fr) 40px;
        justify-content: space-between;
        gap: 10px;
        margin-top: auto;
        padding-top: 8px;
      }

      .continue-button {
        display: inline-flex;
        min-height: 38px;
        align-items: center;
        justify-content: center;
        gap: 7px;
        padding: 7px 14px;
        border-radius: 8px;
        background: linear-gradient(135deg, #a855f7, #7c3aed);
        color: #ffffff;
        font-size: 13px;
        font-weight: 700;
        white-space: nowrap;
        text-decoration: none;
        box-shadow: 0 5px 15px rgba(126, 34, 206, 0.22);
      }

      .continue-button svg {
        width: 15px;
        height: 15px;
      }

      .favorite-button {
        display: grid;
        width: 40px;
        height: 38px;
        place-items: center;
        border: 1px solid rgba(139, 151, 190, 0.2);
        border-radius: 8px;
        background: rgba(8, 14, 28, 0.55);
        color: var(--text-muted);
        cursor: pointer;
      }

      .favorite-button:hover,
      .favorite-button--active {
        border-color: rgba(244, 114, 182, 0.38);
        background: rgba(190, 24, 93, 0.15);
        color: #f472b6;
      }

      .favorite-button svg {
        width: 18px;
        height: 18px;
      }

      .story-collection svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .story-collection--list {
        grid-template-columns: 1fr;
      }

      .story-collection--list .story-card {
        min-height: 120px;
        grid-template-columns:
          100px
          minmax(0, 1fr);
      }

      .story-collection--list .story-cover {
        min-height: 110px;
      }

      .story-collection--list .story-information {
        display: grid;
        grid-template-columns:
          minmax(180px, 1.5fr)
          minmax(140px, 1fr)
          160px;
        align-items: center;
        column-gap: 18px;
      }

      .story-collection--list .story-title,
      .story-collection--list .story-author,
      .story-collection--list .genre-list {
        grid-column: 1;
      }

      .story-collection--list .chapter-row,
      .story-collection--list .progress-track,
      .story-collection--list .last-read {
        grid-column: 2;
      }

      .story-collection--list .story-actions {
        grid-column: 3;
        grid-row: 1 / 5;
        align-self: center;
      }

      .library-empty {
        --empty-grid-column: 1 / -1;

        --empty-min-height: 390px;

        --empty-padding: 35px;

        --empty-icon-box-size: 62px;

        --empty-icon-background: rgba(126, 34, 206, 0.14);

        --empty-icon-color: #c084fc;

        --empty-title-color: #f4f1fa;

        --empty-title-size: 16px;

        --empty-description-color: #858fa7;

        --empty-description-size: 12.5px;
      }

      @media (max-width: 1050px) {
        .story-collection {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 680px) {
        .story-card,
        .story-collection--list .story-card {
          grid-template-columns:
            92px
            minmax(0, 1fr);
        }

        .story-cover,
        .story-collection--list .story-cover {
          min-height: 115px;
        }

        .story-collection--list .story-information {
          display: flex;
        }

        .story-collection--list .story-actions {
          align-self: auto;
        }
      }

      @media (max-width: 430px) {
        .story-card,
        .story-collection--list .story-card {
          grid-template-columns: 1fr;
        }

        .story-cover,
        .story-collection--list .story-cover {
          min-height: 180px;
        }
      }
    `,
  ],
})
export class LibraryStoryListComponent {
  @Input({ required: true })
  stories: readonly LibraryStory[] = [];

  @Input()
  viewMode: LibraryViewMode = 'grid';

  @Output()
  readonly favoriteToggle = new EventEmitter<string>();

  getStatusKey(story: LibraryStory): string {
    if (story.isCompleted) {
      return 'completed';
    }

    if (story.isFavorite) {
      return 'favorite';
    }

    if (story.isReading) {
      return 'reading';
    }

    return 'following';
  }

  getStatusLabel(story: LibraryStory): string {
    if (story.isCompleted) {
      return 'FULL';
    }

    if (story.isFavorite) {
      return 'YÊU THÍCH';
    }

    if (story.isReading) {
      return 'ĐANG ĐỌC';
    }

    return 'THEO DÕI';
  }
}

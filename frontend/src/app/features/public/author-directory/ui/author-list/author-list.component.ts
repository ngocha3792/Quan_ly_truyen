import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { AuthorDirectoryItem } from '../../domain/author-directory.models';

@Component({
  selector: 'app-author-list',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="author-list">
      @for (author of authors; track author.id) {
        <article class="author-row">
          <a class="author-main" [routerLink]="['/tac-gia', author.slug]">
            <div class="author-avatar">
              {{ author.initials }}

              @if (author.verified) {
                <span class="verified" title="Tác giả đã xác minh">
                  <svg viewBox="0 0 24 24">
                    <path
                      d="m12 2 2.1 2.2 3-.3.9 2.9 2.7 1.5-1.2 2.8 1.2 2.8-2.7 1.5-.9 2.9-3-.3L12 22l-2.1-2.2-3 .3-.9-2.9-2.7-1.5 1.2-2.8-1.2-2.8L6 8.6l.9-2.9 3 .3L12 2Z"
                    ></path>

                    <path d="m8.5 12 2.2 2.2 4.8-4.8"></path>
                  </svg>
                </span>
              }
            </div>

            <div class="author-information">
              <h2>{{ author.name }}</h2>

              <strong>
                {{ author.genre }}
              </strong>

              <p>
                {{ author.description }}
              </p>
            </div>
          </a>

          <div class="metric">
            <svg viewBox="0 0 24 24">
              <path
                d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"
              ></path>

              <path d="M8 8h8"></path>
            </svg>

            <strong>
              {{ author.worksLabel }}
            </strong>

            <small>Tác phẩm</small>
          </div>

          <div class="metric">
            <svg viewBox="0 0 24 24">
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path>

              <circle cx="12" cy="12" r="2.5"></circle>
            </svg>

            <strong>
              {{ author.readsLabel }}
            </strong>

            <small>Lượt đọc</small>
          </div>

          <div class="metric">
            <svg viewBox="0 0 24 24">
              <circle cx="9" cy="8" r="3"></circle>

              <path d="M3.5 19c.5-3.4 2.3-5 5.5-5s5 1.6 5.5 5"></path>

              <path d="M16 6a3 3 0 0 1 0 5"></path>
            </svg>

            <strong>
              {{ author.followersLabel }}
            </strong>

            <small>Theo dõi</small>
          </div>

          <button
            class="follow-button"
            type="button"
            [class.follow-button--active]="followedAuthorIds.includes(author.id)"
            (click)="followToggle.emit(author.id)"
          >
            @if (followedAuthorIds.includes(author.id)) {
              <svg viewBox="0 0 24 24">
                <path d="m5 12 4 4L19 6"></path>
              </svg>

              Đang theo dõi
            } @else {
              <svg viewBox="0 0 24 24">
                <path d="M12 5v14"></path>
                <path d="M5 12h14"></path>
              </svg>

              Theo dõi
            }
          </button>
        </article>
      } @empty {
        <app-empty-state
          class="author-empty"
          icon="search"
          [iconSize]="28"
          title="Không tìm thấy tác giả"
          description="Hãy thử tìm kiếm bằng tên hoặc thể loại khác."
        />
      }
    </section>
  `,

  styles: [
    `
      :host {
        display: block;
      }

      .author-list {
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: rgba(8, 14, 28, 0.45);
      }

      .author-row {
        display: grid;
        min-height: 90px;
        grid-template-columns:
          minmax(280px, 1fr)
          100px
          110px
          110px
          125px;
        align-items: center;
        gap: 16px;
        padding: 12px 18px;
        border-bottom: 1px solid var(--border);
      }

      .author-row:last-child {
        border-bottom: 0;
      }

      .author-row:hover {
        background: linear-gradient(
          90deg,
          rgba(140, 77, 232, 0.08),
          rgba(18, 25, 46, 0.52),
          transparent
        );
      }

      .author-main {
        display: grid;
        min-width: 0;
        grid-template-columns: 60px minmax(0, 1fr);
        align-items: center;
        gap: 14px;
        color: inherit;
        text-decoration: none;
      }

      .author-avatar {
        position: relative;
        display: grid;
        width: 56px;
        height: 56px;
        place-items: center;
        border: 1px solid rgba(168, 85, 247, 0.45);
        border-radius: 50%;
        background: linear-gradient(145deg, rgba(30, 27, 75, 0.85), rgba(15, 23, 42, 0.95));
        box-shadow: 0 0 16px rgba(140, 77, 232, 0.15);
        color: #f8f6fb;
        font-size: 20px;
        font-weight: 800;
      }

      .verified {
        position: absolute;
        right: -1px;
        bottom: -1px;
        display: grid;
        width: 19px;
        height: 19px;
        place-items: center;
        border: 2px solid #0c1325;
        border-radius: 50%;
        background: var(--primary);
        color: #ffffff;
      }

      .verified svg {
        width: 14px;
        height: 14px;
      }

      .author-information {
        min-width: 0;
      }

      .author-information h2 {
        overflow: hidden;
        margin: 0 0 4px;
        color: var(--text-strong);
        font-size: 15.5px;
        font-weight: 700;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .author-information strong {
        display: block;
        margin-bottom: 4px;
        color: var(--primary-soft);
        font-size: 12px;
        font-weight: 600;
      }

      .author-information p {
        overflow: hidden;
        margin: 0;
        color: var(--text-secondary);
        font-size: 13px;
        line-height: 1.5;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .metric {
        display: grid;
        grid-template-columns: 20px minmax(0, 1fr);
        align-items: center;
        column-gap: 8px;
        color: var(--text-muted);
      }

      .metric svg {
        grid-row: 1 / 3;
        width: 18px;
        height: 18px;
        color: var(--primary-soft);
      }

      .metric strong {
        color: var(--text-strong);
        font-size: 13.5px;
        font-weight: 650;
      }

      .metric small {
        color: var(--text-muted);
        font-size: 11.5px;
      }

      .follow-button {
        display: inline-flex;
        min-height: 38px;
        align-items: center;
        justify-content: center;
        gap: 7px;
        padding: 0 16px;
        border: 1px solid rgba(197, 143, 255, 0.28);
        border-radius: 8px;
        background: rgba(76, 29, 149, 0.12);
        color: var(--primary-soft);
        font: inherit;
        font-size: 13px;
        font-weight: 650;
        cursor: pointer;
        transition:
          background-color 0.2s ease,
          border-color 0.2s ease;
      }

      .follow-button:hover,
      .follow-button--active {
        background: linear-gradient(135deg, rgba(147, 51, 234, 0.85), rgba(109, 40, 217, 0.85));
        color: #ffffff;
        box-shadow: 0 6px 18px rgba(126, 34, 206, 0.22);
      }

      .follow-button svg {
        width: 14px;
        height: 14px;
      }

      .author-row svg {
        --empty-min-height: 350px;

        --empty-padding: 30px;

        --empty-icon-box-size: 58px;

        --empty-icon-background: rgba(126, 34, 206, 0.15);

        --empty-icon-color: #c084fc;

        --empty-title-color: #f5f3fb;

        --empty-title-size: 17px;

        --empty-description-color: #858fa7;

        --empty-description-size: 11px;
      }

      @media (max-width: 1050px) {
        .author-row {
          grid-template-columns:
            minmax(260px, 1fr)
            80px
            90px
            105px;
        }

        .metric:nth-of-type(2) {
          display: none;
        }
      }

      @media (max-width: 760px) {
        .author-row {
          grid-template-columns:
            minmax(0, 1fr)
            100px;
        }

        .metric {
          display: none;
        }
      }

      @media (max-width: 480px) {
        .author-row {
          grid-template-columns: 1fr;
        }

        .follow-button {
          width: 100%;
        }
      }
    `,
  ],
})
export class AuthorListComponent {
  @Input({ required: true })
  authors: readonly AuthorDirectoryItem[] = [];

  @Input()
  followedAuthorIds: readonly string[] = [];

  @Output()
  readonly followToggle = new EventEmitter<string>();
}

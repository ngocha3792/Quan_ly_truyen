import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthorTopStory } from '../../domain/author-studio.models';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-dashboard-bottom-panels',
  standalone: true,

  imports: [RouterLink, IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="quick-actions dashboard-card">
      <header>
        <h2>Thao tác nhanh</h2>
      </header>

      <div class="action-grid">
        <a class="action-card action-card--purple" routerLink="/author-studio/truyen">
          <app-icon name="edit" [size]="28"></app-icon>

          <span>Viết chương mới</span>
        </a>

        <a class="action-card action-card--blue" routerLink="/author-studio/truyen">
          <app-icon name="image" [size]="28"></app-icon>

          <span>Quản lý bìa truyện</span>
        </a>
      </div>
    </section>

    <section class="top-stories dashboard-card">
      <header>
        <h2>Top truyện nổi bật của tôi</h2>
      </header>

      <div class="top-story-list">
        @for (story of topStories; track story.id) {
          <article>
            <span class="story-rank" [attr.data-rank]="story.rank">
              {{ story.rank }}
            </span>

            <img [src]="story.coverUrl" [alt]="story.title" />

            <strong>{{ story.title }}</strong>

            <span class="story-views">
              <app-icon name="eye" [size]="13"></app-icon>

              {{ story.views }}
            </span>
          </article>
        }
      </div>
    </section>
  `,

  styles: [
    `
      :host {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        min-width: 0;
      }

      .dashboard-card {
        min-width: 0;
        min-height: 185px;
        padding: 18px 20px 14px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: #0d1421;
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      h2 {
        margin: 0;
        color: var(--text-strong);
        font-size: 1rem;
        font-weight: 700;
      }

      header a {
        color: #67d8c0;
        font-size: 13px;
        font-weight: 650;
        text-decoration: none;
      }

      header > span {
        color: var(--text-muted);
        font-size: 12px;
      }

      .action-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 14px;
      }

      .action-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 108px;
        gap: 10px;
        padding: 12px 8px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: #09111c;
        color: var(--text-strong);
        text-align: center;
        text-decoration: none;
        transition: all 180ms ease;
      }

      .action-card:hover {
        border-color: rgba(79, 209, 181, 0.4);
        background: rgba(79, 209, 181, 0.06);
      }

      .action-card app-icon {
        display: grid;
        width: 42px;
        height: 42px;
        place-items: center;
        border-radius: 50%;
        background: rgba(79, 209, 181, 0.12);
        color: #67d8c0;
      }

      .action-card--purple app-icon {
        background: rgba(79, 209, 181, 0.12);
        color: #67d8c0;
      }

      .action-card--blue app-icon {
        background: rgba(56, 189, 248, 0.12);
        color: #7dd3fc;
      }

      .action-card--green app-icon {
        background: rgba(22, 163, 74, 0.18);
        color: #4ade80;
      }

      .action-card--orange app-icon {
        background: rgba(217, 119, 6, 0.18);
        color: #fb9161;
      }

      .action-card span {
        color: var(--text-strong);
        font-size: 13px;
        font-weight: 650;
        line-height: 1.3;
      }

      .top-story-list {
        display: grid;
        margin-top: 12px;
      }

      .top-story-list article {
        display: grid;
        min-height: 52px;
        grid-template-columns: 28px 32px minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        border-bottom: 1px solid var(--border);
      }

      .top-story-list article:last-child {
        border-bottom: 0;
      }

      .story-rank {
        display: grid;
        width: 24px;
        height: 24px;
        place-items: center;
        border-radius: 5px;
        background: #e0a916;
        color: #ffffff;
        font-size: 12px;
        font-weight: 800;
      }

      .story-rank[data-rank='2'] {
        background: #939aa9;
      }

      .story-rank[data-rank='3'] {
        background: #b56a21;
      }

      .top-story-list img {
        width: 30px;
        height: 40px;
        border-radius: 4px;
        object-fit: cover;
      }

      .top-story-list strong {
        overflow: hidden;
        color: var(--text-strong);
        font-size: 13.5px;
        font-weight: 650;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .story-views {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--text-muted);
        font-size: 12px;
      }

      @media (max-width: 1200px) {
        :host {
          grid-template-columns: 1fr 1fr;
        }
      }

      @media (max-width: 700px) {
        :host {
          grid-template-columns: 1fr;
        }

        .action-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    `,
  ],
})
export class DashboardBottomPanelsComponent {
  @Input({ required: true })
  topStories: readonly AuthorTopStory[] = [];
}

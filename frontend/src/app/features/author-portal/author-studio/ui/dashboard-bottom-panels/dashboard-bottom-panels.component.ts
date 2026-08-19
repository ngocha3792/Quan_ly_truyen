import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthorTopStory } from '../../domain/author-studio.models';
import { StudioIconComponent } from '../studio-icon/studio-icon.component';

@Component({
  selector: 'app-dashboard-bottom-panels',
  standalone: true,

  imports: [RouterLink, StudioIconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="quick-actions dashboard-card">
      <header>
        <h2>Thao tác nhanh</h2>
      </header>

      <div class="action-grid">
        <a class="action-card action-card--purple" routerLink="/author-studio/truyen">
          <app-studio-icon name="edit" [size]="28"></app-studio-icon>

          <span>Viết chương mới</span>
        </a>

        <a class="action-card action-card--blue" routerLink="/author-studio/truyen">
          <app-studio-icon name="image" [size]="28"></app-studio-icon>

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
              <app-studio-icon name="eye" [size]="13"></app-studio-icon>

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
        grid-template-columns: 1.05fr 1fr;
        gap: 10px;
        min-width: 0;
      }

      .dashboard-card {
        min-width: 0;
        min-height: 185px;
        padding: 18px 20px 14px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: linear-gradient(145deg, rgba(16, 22, 39, 0.95), rgba(10, 15, 28, 0.95));
        box-shadow: 0 14px 35px rgba(0, 0, 0, 0.15);
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      h2 {
        margin: 0;
        color: #f5f2fa;
        font-size: 1.1rem;
        font-weight: 700;
      }

      header a {
        color: #b967ff;
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
        grid-template-columns: repeat(4, minmax(0, 1fr));
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
        border-radius: 10px;
        background: rgba(14, 22, 39, 0.7);
        color: var(--text-strong);
        text-align: center;
        text-decoration: none;
        transition: all 180ms ease;
      }

      .action-card:hover {
        border-color: rgba(168, 85, 247, 0.4);
        background: linear-gradient(145deg, rgba(30, 22, 55, 0.85), rgba(18, 25, 45, 0.85));
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(124, 58, 237, 0.15);
      }

      .action-card app-studio-icon {
        display: grid;
        width: 42px;
        height: 42px;
        place-items: center;
        border-radius: 50%;
        background: rgba(126, 34, 206, 0.16);
        color: #c084fc;
      }

      .action-card--purple app-studio-icon {
        background: rgba(168, 85, 247, 0.18);
        color: #c084fc;
      }

      .action-card--blue app-studio-icon {
        background: rgba(37, 99, 235, 0.18);
        color: #5c88ff;
      }

      .action-card--green app-studio-icon {
        background: rgba(22, 163, 74, 0.18);
        color: #4ade80;
      }

      .action-card--orange app-studio-icon {
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

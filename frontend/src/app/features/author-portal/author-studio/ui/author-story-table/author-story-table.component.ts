import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthorStudioStory } from '../../domain/author-studio.models';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-author-story-table',
  standalone: true,

  imports: [RouterLink, IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="dashboard-card">
      <header>
        <h2>Truyện của tôi</h2>

        <a routerLink="/author-studio/truyen"> Xem tất cả </a>
      </header>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Truyện</th>
              <th>Thể loại</th>
              <th>Trạng thái</th>
              <th>Chương mới nhất</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            @for (story of stories; track story.id) {
              <tr>
                <td>
                  <a class="story-title" [routerLink]="['/truyen', story.slug]">
                    <img [src]="story.coverUrl" [alt]="story.title" />

                    <strong>
                      {{ story.title }}
                    </strong>
                  </a>
                </td>

                <td>
                  <div class="genre-list">
                    @for (genre of story.genres; track genre) {
                      <span>{{ genre }}</span>
                    }
                  </div>
                </td>

                <td>
                  <span class="story-status" [attr.data-status]="story.status">
                    {{ story.statusLabel }}
                  </span>
                </td>

                <td>
                  <strong class="chapter">
                    Chương
                    {{ story.latestChapter }}
                  </strong>

                  <small>
                    {{ story.updatedAt }}
                  </small>
                </td>

                <td>
                  <a
                    class="edit-button"
                    routerLink="/author-studio/truyen"
                    aria-label="Chỉnh sửa truyện"
                  >
                    <app-icon name="edit" [size]="14"></app-icon>
                  </a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,

  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        height: 100%;
      }

      .dashboard-card {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 18px 20px 14px;
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: linear-gradient(145deg, rgba(16, 22, 39, 0.95), rgba(10, 15, 28, 0.95));
        box-shadow: 0 14px 35px rgba(0, 0, 0, 0.15);
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
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

      .table-wrap {
        flex: 1;
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        white-space: nowrap;
      }

      th {
        padding: 8px 10px 12px;
        color: var(--text-muted);
        font-size: 12px;
        font-weight: 600;
        text-align: left;
        border-bottom: 1px solid var(--border);
      }

      td {
        padding: 10px 10px;
        border-bottom: 1px solid var(--border);
        color: var(--text-secondary);
        font-size: 13px;
        vertical-align: middle;
      }

      tr:last-child td {
        border-bottom: 0;
      }

      .story-title {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--text-strong);
        text-decoration: none;
      }

      .story-title img {
        width: 32px;
        height: 42px;
        flex-shrink: 0;
        border-radius: 4px;
        object-fit: cover;
      }

      .story-title strong {
        max-width: 150px;
        overflow: hidden;
        color: var(--text-strong);
        font-size: 13px;
        font-weight: 650;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .genre-list {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      .genre-list span {
        padding: 3px 7px;
        border-radius: 4px;
        background: rgba(92, 59, 157, 0.2);
        color: #af88e8;
        font-size: 11px;
      }

      .story-status {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 5px;
        background: rgba(22, 163, 74, 0.12);
        color: #4ade80;
        font-size: 11.5px;
        font-weight: 600;
        white-space: nowrap;
      }

      .story-status[data-status='paused'] {
        background: rgba(217, 119, 6, 0.12);
        color: #f59e0b;
      }

      .chapter {
        display: block;
        color: var(--text-strong);
        font-size: 13px;
        font-weight: 650;
      }

      td small {
        display: block;
        margin-top: 2px;
        color: var(--text-muted);
        font-size: 11.5px;
      }

      .edit-button {
        display: grid;
        width: 32px;
        height: 32px;
        place-items: center;
        border: 1px solid var(--border);
        border-radius: 6px;
        color: var(--text-secondary);
        text-decoration: none;
      }

      .edit-button:hover {
        border-color: rgba(192, 132, 252, 0.4);
        color: #c084fc;
      }
    `,
  ],
})
export class AuthorStoryTableComponent {
  @Input({ required: true })
  stories: readonly AuthorStudioStory[] = [];
}

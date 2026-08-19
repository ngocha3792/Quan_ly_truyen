import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { AuthorReaderComment } from '../../domain/author-studio.models';

@Component({
  selector: 'app-reader-comments',
  standalone: true,

  imports: [],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="dashboard-card">
      <header>
        <h2>Bình luận cần phản hồi</h2>
      </header>

      <div class="comment-list">
        @for (comment of comments; track comment.id) {
          <article>
            <img [src]="comment.avatarUrl" [alt]="comment.readerName" />

            <div class="comment-information">
              <div class="comment-heading">
                <strong>
                  {{ comment.readerName }}
                </strong>

                <span>
                  {{ comment.storyTitle }}
                </span>

                <time>
                  {{ comment.createdAt }}
                </time>
              </div>

              <p>{{ comment.content }}</p>
            </div>
          </article>
        }
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
        border: 1px solid var(--border);
        border-radius: 12px;
        background: linear-gradient(145deg, rgba(16, 22, 39, 0.95), rgba(10, 15, 28, 0.95));
        box-shadow: 0 14px 35px rgba(0, 0, 0, 0.15);
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
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

      .comment-list {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-around;
      }

      article {
        position: relative;
        display: grid;
        min-height: 70px;
        grid-template-columns: 38px minmax(0, 1fr);
        align-items: start;
        gap: 12px;
        padding: 10px 8px;
        border-bottom: 1px solid var(--border);
      }

      article:last-child {
        border-bottom: 0;
      }

      article img {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
      }

      .comment-information {
        min-width: 0;
      }

      .comment-heading {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 8px;
      }

      .comment-heading strong {
        color: var(--text-strong);
        font-size: 13.5px;
        font-weight: 650;
      }

      .comment-heading span {
        overflow: hidden;
        padding: 3px 8px;
        border-radius: 999px;
        background: rgba(126, 34, 206, 0.16);
        color: #b474e9;
        font-size: 11.5px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      time {
        margin-left: auto;
        color: var(--text-muted);
        font-size: 11.5px;
        white-space: nowrap;
      }

      p {
        overflow: hidden;
        margin: 6px 0 0;
        color: var(--text-secondary);
        font-size: 13px;
        line-height: 1.45;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ],
})
export class ReaderCommentsComponent {
  @Input({ required: true })
  comments: readonly AuthorReaderComment[] = [];
}

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { ChapterComment } from '../../domain/chapter-reader.models';

@Component({
  selector: 'app-chapter-comments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="comments">
      <header class="comments-header">
        <h2>Bình luận ({{ totalComments }})</h2>

        <label>
          <span>Sắp xếp:</span>

          <select>
            <option>Mới nhất</option>
            <option>Nhiều lượt thích</option>
            <option>Cũ nhất</option>
          </select>
        </label>
      </header>

      <div class="comment-editor">
        <span class="editor-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4"></circle>

            <path d="M4 21c.6-5 3.3-7.5 8-7.5S19.4 16 20 21"></path>
          </svg>
        </span>

        <input type="text" placeholder="Viết bình luận của bạn..." />

        <button type="button">Gửi</button>
      </div>

      <div class="comment-list">
        @for (comment of comments; track comment.id) {
          <article class="comment">
            <span class="avatar">
              {{ comment.author.initials }}
            </span>

            <div class="comment-body">
              <div class="author-row">
                <strong>
                  {{ comment.author.name }}
                </strong>

                <span> Lv.{{ comment.author.level }} </span>
              </div>

              <time>
                {{ comment.createdAt }}
              </time>

              <p>
                {{ comment.content }}
              </p>

              <div class="comment-actions">
                <button type="button">
                  <svg viewBox="0 0 24 24">
                    <path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Z"></path>

                    <path
                      d="m7 10 4-8c2 0 3 1.5 2.5 3.5L13 8h6a3 3 0 0 1 3 3l-1 7a3 3 0 0 1-3 3H7"
                    ></path>
                  </svg>

                  {{ comment.likes }}
                </button>

                <button type="button">Trả lời</button>
              </div>
            </div>

            <button class="more-button" type="button" aria-label="Tùy chọn bình luận">⋮</button>
          </article>
        }
      </div>
    </section>
  `,

  styles: [
    `
      :host {
        display: block;
      }

      .comments {
        margin-top: 16px;
        padding: 20px 24px 8px;
        border: 1px solid rgba(139, 151, 190, 0.17);
        border-radius: 13px;
        background: linear-gradient(145deg, rgba(14, 21, 40, 0.96), rgba(8, 14, 28, 0.96));
      }

      .comments-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 20px;
      }

      .comments-header h2 {
        margin: 0;
        color: #f7f5ff;
        font-size: 18px;
      }

      .comments-header label {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #b3b9ca;
        font-size: 13px;
      }

      .comments-header select {
        border: 0;
        outline: none;
        background: transparent;
        color: #f1eff9;
        font: inherit;
      }

      .comments-header select option {
        background: #11182c;
      }

      .comment-editor {
        display: grid;
        grid-template-columns: 46px minmax(0, 1fr) 70px;
        align-items: center;
        gap: 12px;
        margin-bottom: 13px;
      }

      .editor-avatar {
        display: grid;
        width: 44px;
        height: 44px;
        place-items: center;
        border-radius: 50%;
        background: #202a43;
        color: #aab2c8;
      }

      .editor-avatar svg {
        width: 27px;
        height: 27px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .comment-editor input {
        width: 100%;
        height: 46px;
        padding: 0 17px;
        border: 1px solid rgba(139, 151, 190, 0.18);
        border-radius: 8px;
        outline: none;
        background: rgba(18, 25, 45, 0.9);
        color: #f7f5ff;
        font: inherit;
        font-size: 13px;
      }

      .comment-editor input::placeholder {
        color: #78829e;
      }

      .comment-editor input:focus {
        border-color: rgba(192, 132, 252, 0.5);
        box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.08);
      }

      .comment-editor > button {
        height: 44px;
        border: 1px solid rgba(216, 180, 254, 0.2);
        border-radius: 8px;
        background: linear-gradient(135deg, #7e22ce, #6d28d9);
        color: #fff;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      .comment {
        position: relative;
        display: grid;
        grid-template-columns: 47px minmax(0, 1fr) 24px;
        gap: 14px;
        padding: 17px 0;
        border-top: 1px solid rgba(139, 151, 190, 0.11);
      }

      .avatar {
        display: grid;
        width: 44px;
        height: 44px;
        place-items: center;
        border: 1px solid rgba(192, 132, 252, 0.18);
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, #c084fc, #6d28d9 48%, #232c48 100%);
        color: #fff;
        font-size: 12px;
        font-weight: 800;
      }

      .author-row {
        display: flex;
        align-items: center;
        gap: 9px;
      }

      .author-row strong {
        color: #f4f1fa;
        font-size: 13px;
      }

      .author-row span {
        padding: 2px 7px;
        border-radius: 999px;
        background: rgba(139, 92, 246, 0.2);
        color: #d5c5f4;
        font-size: 10px;
      }

      time {
        display: block;
        margin-top: 4px;
        color: #7f89a5;
        font-size: 11px;
      }

      .comment-body p {
        margin: 10px 0 11px;
        color: #c5cada;
        font-size: 13px;
        line-height: 1.6;
      }

      .comment-actions {
        display: flex;
        align-items: center;
        gap: 18px;
      }

      .comment-actions button,
      .more-button {
        border: 0;
        background: transparent;
        color: #9ba4bc;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
      }

      .comment-actions button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .comment-actions svg {
        width: 16px;
        height: 16px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .more-button {
        font-size: 23px;
        line-height: 1;
      }

      @media (max-width: 600px) {
        .comments {
          padding-right: 14px;
          padding-left: 14px;
        }

        .comments-header {
          align-items: flex-start;
          flex-direction: column;
          gap: 10px;
        }

        .comment-editor {
          grid-template-columns: 40px minmax(0, 1fr);
        }

        .comment-editor > button {
          grid-column: 2;
        }

        .editor-avatar,
        .avatar {
          width: 38px;
          height: 38px;
        }

        .comment {
          grid-template-columns: 40px minmax(0, 1fr);
        }

        .more-button {
          position: absolute;
          top: 17px;
          right: 0;
        }
      }
    `,
  ],
})
export class ChapterCommentsComponent {
  @Input({ required: true })
  comments: readonly ChapterComment[] = [];

  @Input()
  totalComments = 0;
}

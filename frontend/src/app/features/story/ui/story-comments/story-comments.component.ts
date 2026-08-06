import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { StoryComment } from '../../domain/story.models';

@Component({
  selector: 'app-story-comments',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="side-card comments-card">
      <div class="card-heading">
        <app-icon name="message-circle" [size]="18" />
        <h3>Bình luận mới nhất</h3>
      </div>

      <div class="comment-input-box">
        <textarea placeholder="Viết bình luận của bạn..." rows="2"></textarea>
        <button type="button">Gửi</button>
      </div>

      <div class="comment-list">
        @for (comment of comments(); track comment.id) {
          <div class="comment-item">
            <div class="user-avatar">{{ comment.user[0] }}</div>
            <div class="comment-body">
              <div class="comment-meta">
                <strong>{{ comment.user }}</strong>
                <small>{{ comment.time }}</small>
              </div>
              <p>{{ comment.content }}</p>
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    .side-card {
      padding: 1.25rem;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(13, 18, 33, .88);
    }

    .card-heading {
      display: flex;
      align-items: center;
      gap: .6rem;
      margin-bottom: 1rem;
      color: #a868ef;

      h3 {
        margin: 0;
        color: white;
        font-size: 1.1rem;
        font-weight: 700;
      }
    }

    .comment-input-box {
      display: grid;
      gap: .6rem;
      margin-bottom: 1.25rem;

      textarea {
        width: 100%;
        padding: .75rem;
        border: 1px solid rgba(132, 145, 177, .18);
        border-radius: 8px;
        outline: none;
        color: #dedbe4;
        background: rgba(5, 10, 21, .5);
        font-family: inherit;
        font-size: .875rem;
        resize: none;

        &:focus {
          border-color: #a868ef;
        }
      }

      button {
        justify-self: flex-end;
        padding: .45rem 1.25rem;
        border: 0;
        border-radius: 6px;
        color: white;
        font-weight: 700;
        font-size: .85rem;
        background: linear-gradient(135deg, #a04eed, #6842dc);
        cursor: pointer;

        &:hover {
          opacity: .9;
        }
      }
    }

    .comment-list {
      display: grid;
      gap: 1rem;
    }

    .comment-item {
      display: flex;
      gap: .75rem;
      align-items: flex-start;
    }

    .user-avatar {
      width: 34px;
      height: 34px;
      flex: 0 0 34px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: #fff;
      font-weight: 700;
      font-size: .85rem;
      background: linear-gradient(135deg, #8b44e5, #6366f1);
    }

    .comment-body {
      flex: 1;
      min-width: 0;
      display: grid;
      gap: 3px;

      p {
        margin: 0;
        color: #b2b7c7;
        font-size: .85rem;
        line-height: 1.45;
      }
    }

    .comment-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .5rem;

      strong {
        color: #e0dde6;
        font-size: .85rem;
      }

      small {
        color: #727c90;
        font-size: .75rem;
      }
    }
  `,
})
export class StoryCommentsComponent {
  readonly comments = input.required<readonly StoryComment[]>();
}

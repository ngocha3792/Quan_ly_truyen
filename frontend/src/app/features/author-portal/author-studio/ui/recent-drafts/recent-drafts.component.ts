import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { AuthorStudioDraft } from '../../domain/author-studio.models';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-recent-drafts',
  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="dashboard-card">
      <header>
        <h2>Bản nháp gần đây</h2>
      </header>

      <div class="draft-list">
        @for (draft of drafts; track draft.id) {
          <article>
            <span class="draft-icon">
              <app-icon name="draft" [size]="16"></app-icon>
            </span>

            <div class="draft-information">
              <strong>
                {{ draft.storyTitle }}
              </strong>

              <span>
                {{ draft.chapterTitle }}
              </span>

              <small>
                Cập nhật:
                {{ draft.updatedAt }}
              </small>
            </div>

            <div class="draft-progress">
              <span class="progress-track">
                <span [style.width.%]="draft.completionPercent"></span>
              </span>

              <strong> {{ draft.completionPercent }}% </strong>
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
        margin-bottom: 12px;
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

      .draft-list {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-around;
      }

      article {
        display: grid;
        min-height: 62px;
        grid-template-columns:
          36px
          minmax(100px, 1fr)
          minmax(85px, 0.6fr);
        align-items: center;
        gap: 12px;
        border-bottom: 1px solid var(--border);
      }

      article:last-child {
        border-bottom: 0;
      }

      .draft-icon {
        display: grid;
        width: 34px;
        height: 34px;
        place-items: center;
        border-radius: 8px;
        background: rgba(126, 34, 206, 0.24);
        color: #ba69ff;
      }

      .draft-information {
        display: grid;
        min-width: 0;
        gap: 3px;
      }

      .draft-information strong,
      .draft-information span,
      .draft-information small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .draft-information strong {
        color: var(--text-strong);
        font-size: 13.5px;
        font-weight: 650;
      }

      .draft-information span {
        color: var(--text-secondary);
        font-size: 12px;
      }

      .draft-information small {
        color: var(--text-muted);
        font-size: 11px;
      }

      .draft-progress {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .progress-track {
        width: 100%;
        height: 5px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(111, 124, 153, 0.18);
      }

      .progress-track span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #7c3aed, #b75dff);
      }

      .draft-progress strong {
        color: var(--text-secondary);
        font-size: 12px;
        font-weight: 600;
      }

      article button {
        display: grid;
        width: 32px;
        height: 32px;
        place-items: center;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
      }
    `,
  ],
})
export class RecentDraftsComponent {
  @Input({ required: true })
  drafts: readonly AuthorStudioDraft[] = [];
}

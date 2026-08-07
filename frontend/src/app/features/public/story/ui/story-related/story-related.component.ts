import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { RelatedStoryItem } from '../../domain/story.models';

@Component({
  selector: 'app-story-related',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="side-card related-card">
      <div class="card-heading">
        <app-icon name="sparkles" [size]="18" />
        <h3>Truyện cùng thể loại</h3>
      </div>

      <div class="related-list">
        @for (rel of relatedStories(); track rel.slug) {
          <a class="related-item" [routerLink]="['/truyen', rel.slug]">
            <img [src]="rel.coverUrl" [alt]="rel.title" />
            <div>
              <strong>{{ rel.title }}</strong>
              <small>Ch. {{ rel.latestChapter }}</small>
            </div>
          </a>
        }
      </div>
    </section>
  `,
  styles: `
    .side-card {
      padding: 1.25rem;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(13, 18, 33, 0.88);
    }

    .card-heading {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-bottom: 1rem;
      color: #a868ef;

      h3 {
        margin: 0;
        color: white;
        font-size: 1.1rem;
        font-weight: 700;
      }
    }

    .related-list {
      display: grid;
      gap: 0.8rem;
    }

    .related-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.4rem;
      border-radius: 8px;
      color: inherit;
      text-decoration: none;
      transition: background 150ms ease;

      &:hover {
        background: rgba(255, 255, 255, 0.04);

        strong {
          color: #c58aff;
        }
      }

      img {
        width: 44px;
        height: 58px;
        object-fit: cover;
        border-radius: 6px;
        background: #111827;
      }

      div {
        min-width: 0;
        display: grid;
        gap: 3px;

        strong {
          overflow: hidden;
          color: #dedbe4;
          font-size: 0.875rem;
          font-weight: 600;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        small {
          color: #727c90;
          font-size: 0.78rem;
        }
      }
    }
  `,
})
export class StoryRelatedComponent {
  readonly relatedStories = input.required<readonly RelatedStoryItem[]>();
}

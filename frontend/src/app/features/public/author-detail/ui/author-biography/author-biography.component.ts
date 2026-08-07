
import {
    ChangeDetectionStrategy,
    Component,
    Input,
} from '@angular/core';

@Component({
    selector: 'app-author-biography',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,

    template: `
    <section class="biography panel">
      <header class="section-heading">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="7" r="3"></circle>
          <path d="M5 21c.5-5 2.8-7.5 7-7.5s6.5 2.5 7 7.5"></path>
          <path d="M18 4h3"></path>
          <path d="M19.5 2.5v3"></path>
        </svg>

        <h2>Giới thiệu tác giả</h2>
      </header>

      @for (paragraph of biography; track $index) {
        <p>{{ paragraph }}</p>
      }
    </section>
  `,

    styles: [`
    :host {
      display: block;
    }

    .panel {
      margin-top: 0;
      padding: 1.25rem;
      border: 1px solid var(--border);
      border-radius: 12px;
      background:
        linear-gradient(
          145deg,
          rgba(16, 22, 39, 0.9),
          rgba(10, 15, 28, 0.92)
        );
      box-shadow: 0 14px 35px rgba(0, 0, 0, 0.15);
    }

    .section-heading {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .section-heading svg {
      width: 20px;
      height: 20px;
      color: var(--primary-soft);
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    h2 {
      margin: 0;
      color: var(--text-strong);
      font-size: 1.05rem;
      font-weight: 700;
    }

    p {
      margin: 10px 0 0;
      color: var(--text-secondary);
      font-size: .9rem;
      line-height: 1.65;
    }
  `],
})
export class AuthorBiographyComponent {
    @Input({ required: true })
    biography: readonly string[] = [];
}
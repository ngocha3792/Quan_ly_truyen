import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-section-heading',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="heading">
      <div class="title-wrap">
        <span class="bar"></span>
        <h2>{{ title() }}</h2>
      </div>
      @if (link()) {
        <a [routerLink]="link()">Xem tất cả <app-icon name="chevron-right" [size]="16" /></a>
      }
    </div>
  `,
  styles: `
    .heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .title-wrap {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      min-width: 0;
    }
    .bar {
      width: 4px;
      height: 23px;
      border-radius: 4px;
      background: linear-gradient(#d86cff, #6947ff);
      box-shadow: 0 0 14px rgba(152, 81, 255, 0.45);
    }
    h2 {
      margin: 0;
      font-size: 1.22rem;
      letter-spacing: -0.025em;
      color: var(--text-strong);
    }
    a {
      display: inline-flex;
      align-items: center;
      gap: 0.15rem;
      color: var(--text-muted);
      font-size: 0.84rem;
      text-decoration: none;
      white-space: nowrap;
    }
    a:hover {
      color: var(--text-strong);
    }
  `,
})
export class SectionHeadingComponent {
  readonly title = input.required<string>();
  readonly link = input<string | null>(null);
}

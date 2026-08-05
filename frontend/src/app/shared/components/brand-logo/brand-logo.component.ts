import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-brand-logo',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/" class="brand" aria-label="TruyenHub - Trang chủ">
      <span class="mark" aria-hidden="true">
        <span></span><span></span>
      </span>
      @if (!compact()) { <strong>TruyenHub</strong> }
    </a>
  `,
  styles: `
    .brand { display: inline-flex; align-items: center; gap: .65rem; color: #f8f7ff; text-decoration: none; }
    strong { font-size: 1.35rem; letter-spacing: -.04em; font-weight: 800; }
    .mark { position: relative; display: inline-flex; width: 30px; height: 28px; filter: drop-shadow(0 0 12px rgba(149, 86, 255, .4)); }
    .mark span { position: absolute; inset-block: 2px; width: 14px; background: linear-gradient(145deg, #b77cff, #7252ff); }
    .mark span:first-child { left: 0; border-radius: 4px 1px 1px 4px; transform: skewY(-8deg); }
    .mark span:last-child { right: 0; border-radius: 1px 4px 4px 1px; transform: skewY(8deg); background: linear-gradient(145deg, #fa74d3, #865bff); }
    .mark::after { content: ''; position: absolute; width: 2px; height: 24px; left: 14px; top: 2px; background: #e9dcff; border-radius: 10px; }
  `,
})
export class BrandLogoComponent {
  readonly compact = input(false);
}
